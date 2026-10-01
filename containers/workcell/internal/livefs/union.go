// Package livefs implements the per-workspace union filesystem: a git tree
// at a pinned commit (lower, read straight from the shared mirror) merged with
// a plain upper directory, with whiteouts, copy-up, read-set logging and
// atomic generation swaps.
//
// Union holds all the semantics and is FUSE-independent (unit-testable
// anywhere); fuse.go adapts it to go-fuse.
package livefs

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"

	"livemain/workcell/internal/gitstore"
)

// Lower is the read-only layer: a commit's tree.
type Lower interface {
	Commit() string
	Lookup(p string) (gitstore.Entry, bool)
	Children(dir string) []string
	Files(prefix string) []string
}

// BlobSource reads blob contents by id.
type BlobSource interface {
	Blob(ctx context.Context, sha string) ([]byte, error)
}

// Virtual entries at the mount root.
const (
	DepsName     = "node_modules"
	MetaDir      = ".livemain"
	InboxPath    = ".livemain/inbox"
	inboxName    = "inbox"
	renameNoRepl = 0x1 // RENAME_NOREPLACE
	renameExch   = 0x2 // RENAME_EXCHANGE
)

// FileType of a resolved entry.
type FileType uint8

const (
	TypeFile FileType = iota + 1
	TypeDir
	TypeSymlink
)

// Layer that provides a resolved entry.
type Layer uint8

const (
	LayerUpper Layer = iota + 1
	LayerLower
	LayerVirtual
)

// Stat is the merged view of one path.
type Stat struct {
	Layer   Layer
	Type    FileType
	Perm    uint32
	Size    int64
	Mtime   time.Time
	BlobSHA string // lower files only
	// Version is the generation in which this (non-directory) path last
	// changed under the workspace (0 = never). It is part of the inode
	// number, so a swapped file gets a fresh kernel inode and page cache
	// while handles opened earlier keep the old ones.
	Version uint64
}

// DirEntry is one merged directory entry.
type DirEntry struct {
	Name    string
	Type    FileType
	Version uint64
}

// Change is one overlay change relative to the lower layer (nil = delete).
type Change struct {
	Path    string  `json:"path"`
	Content *string `json:"content"`
}

// Config configures a Union.
type Config struct {
	UpperDir   string
	DepsTarget string        // target of the virtual node_modules symlink
	Inbox      func() []byte // renders .livemain/inbox
	Blobs      BlobSource
}

// Union is the merged lower+upper view of one workspace.
type Union struct {
	cfg Config

	mu        sync.RWMutex
	lower     Lower
	gen       uint64
	whiteouts map[string]struct{} // lower hidden at this path and below
	mtimes    map[string]time.Time
	versions  map[string]uint64 // see Stat.Version
	created   time.Time

	rsMu     sync.Mutex          // nested inside mu
	reads    map[string]struct{} // regular files opened for reading
	lookups  map[string]struct{} // regular files resolved (LOOKUP) but maybe never opened
	readdirs map[string]struct{}
}

// NewUnion creates a union over lower with an (existing or new) upper dir.
func NewUnion(cfg Config, lower Lower) (*Union, error) {
	if err := os.MkdirAll(cfg.UpperDir, 0o755); err != nil {
		return nil, err
	}
	if cfg.Inbox == nil {
		cfg.Inbox = func() []byte { return nil }
	}
	return &Union{
		cfg:       cfg,
		lower:     lower,
		gen:       1,
		whiteouts: make(map[string]struct{}),
		mtimes:    make(map[string]time.Time),
		versions:  make(map[string]uint64),
		created:   time.Now(),
		reads:     make(map[string]struct{}),
		lookups:   make(map[string]struct{}),
		readdirs:  make(map[string]struct{}),
	}, nil
}

// Generation returns the current generation (starts at 1).
func (u *Union) Generation() uint64 {
	u.mu.RLock()
	defer u.mu.RUnlock()
	return u.gen
}

// Lower returns the current lower layer.
func (u *Union) Lower() Lower {
	u.mu.RLock()
	defer u.mu.RUnlock()
	return u.lower
}

// UpperDir returns the upper directory.
func (u *Union) UpperDir() string { return u.cfg.UpperDir }

// ---- path helpers ----

// Ignored reports whether reads of p are never logged.
func Ignored(p string) bool {
	first, _, _ := strings.Cut(p, "/")
	if first == MetaDir || first == ".git" {
		return true
	}
	for _, c := range strings.Split(p, "/") {
		if c == DepsName || c == ".git" {
			return true
		}
	}
	return false
}

// Reserved reports whether p may not be created or modified.
func Reserved(p string) bool {
	first, _, _ := strings.Cut(p, "/")
	return first == DepsName || first == MetaDir
}

func parentOf(p string) string {
	if i := strings.LastIndexByte(p, '/'); i >= 0 {
		return p[:i]
	}
	return ""
}

func baseOf(p string) string {
	if i := strings.LastIndexByte(p, '/'); i >= 0 {
		return p[i+1:]
	}
	return p
}

func join(dir, name string) string { return gitstore.Join(dir, name) }

func hasPrefixPath(p, prefix string) bool {
	return prefix == "" || p == prefix || strings.HasPrefix(p, prefix+"/")
}

func (u *Union) upperPath(p string) string {
	if p == "" {
		return u.cfg.UpperDir
	}
	return filepath.Join(u.cfg.UpperDir, filepath.FromSlash(p))
}

// ---- resolution ----

func (u *Union) virtualStat(p string) (Stat, syscall.Errno, bool) {
	switch {
	case p == DepsName:
		return Stat{Layer: LayerVirtual, Type: TypeSymlink, Perm: 0o777, Size: int64(len(u.cfg.DepsTarget)), Mtime: u.created}, 0, true
	case p == MetaDir:
		return Stat{Layer: LayerVirtual, Type: TypeDir, Perm: 0o555, Mtime: u.created}, 0, true
	case p == InboxPath:
		return Stat{Layer: LayerVirtual, Type: TypeFile, Perm: 0o444, Size: int64(len(u.cfg.Inbox())), Mtime: time.Now()}, 0, true
	case strings.HasPrefix(p, MetaDir+"/") || strings.HasPrefix(p, DepsName+"/"):
		return Stat{}, syscall.ENOENT, true
	}
	return Stat{}, 0, false
}

// hiddenLocked reports whether the lower layer is whited out at p.
func (u *Union) hiddenLocked(p string) bool {
	if len(u.whiteouts) == 0 {
		return false
	}
	for i := 0; i <= len(p); i++ {
		if i == len(p) || p[i] == '/' {
			if _, ok := u.whiteouts[p[:i]]; ok {
				return true
			}
		}
	}
	return false
}

func (u *Union) lowerVisibleLocked(p string) (gitstore.Entry, bool) {
	if u.hiddenLocked(p) {
		return gitstore.Entry{}, false
	}
	return u.lower.Lookup(p)
}

func (u *Union) upperStat(p string) (Stat, bool) {
	fi, err := os.Lstat(u.upperPath(p))
	if err != nil {
		return Stat{}, false
	}
	st := Stat{Layer: LayerUpper, Perm: uint32(fi.Mode().Perm()), Size: fi.Size(), Mtime: fi.ModTime()}
	switch {
	case fi.IsDir():
		st.Type = TypeDir
	case fi.Mode()&fs.ModeSymlink != 0:
		st.Type = TypeSymlink
	case fi.Mode().IsRegular():
		st.Type = TypeFile
	default:
		return Stat{}, false
	}
	return st, true
}

func (u *Union) mtimeLocked(p string) time.Time {
	if t, ok := u.mtimes[p]; ok {
		return t
	}
	return u.created
}

func (u *Union) lowerStat(p string, e gitstore.Entry) Stat {
	st := Stat{Layer: LayerLower, Size: e.Size, Mtime: u.mtimeLocked(p), BlobSHA: e.SHA}
	switch {
	case e.IsDir():
		st.Type, st.Perm, st.Size = TypeDir, 0o755, 4096
	case e.IsSymlink():
		st.Type, st.Perm = TypeSymlink, 0o777
	case e.Mode == gitstore.ModeExec:
		st.Type, st.Perm = TypeFile, 0o755
	default:
		st.Type, st.Perm = TypeFile, 0o644
	}
	return st
}

func (u *Union) statLocked(p string) (Stat, syscall.Errno) {
	if st, errno, ok := u.virtualStat(p); ok {
		return st, errno
	}
	if st, ok := u.upperStat(p); ok {
		st.Version = u.versionLocked(p, st.Type)
		return st, 0
	}
	if e, ok := u.lowerVisibleLocked(p); ok {
		st := u.lowerStat(p, e)
		st.Version = u.versionLocked(p, st.Type)
		return st, 0
	}
	return Stat{}, syscall.ENOENT
}

func (u *Union) versionLocked(p string, t FileType) uint64 {
	if t == TypeDir {
		return 0
	}
	return u.versions[p]
}

// Stat resolves p in the merged view without logging.
func (u *Union) Stat(p string) (Stat, syscall.Errno) {
	u.mu.RLock()
	defer u.mu.RUnlock()
	return u.statLocked(p)
}

// Lookup resolves p and logs it in the lookup set if it is a regular file.
// A successful lookup records an existence dependency only: module
// resolvers (vite) stat every lazily imported file without reading it, so
// lookups are kept apart from the read set (content dependencies).
func (u *Union) Lookup(p string) (Stat, syscall.Errno) {
	u.mu.RLock()
	defer u.mu.RUnlock()
	st, errno := u.statLocked(p)
	if errno == 0 && st.Type == TypeFile && st.Layer != LayerVirtual && !Ignored(p) {
		u.rsMu.Lock()
		u.lookups[p] = struct{}{}
		u.rsMu.Unlock()
	}
	return st, errno
}

func (u *Union) recordLocked(p string) {
	if Ignored(p) {
		return
	}
	u.rsMu.Lock()
	u.reads[p] = struct{}{}
	u.rsMu.Unlock()
}

// Readlink returns a symlink's target.
func (u *Union) Readlink(ctx context.Context, p string) (string, syscall.Errno) {
	u.mu.RLock()
	defer u.mu.RUnlock()
	st, errno := u.statLocked(p)
	if errno != 0 {
		return "", errno
	}
	if st.Type != TypeSymlink {
		return "", syscall.EINVAL
	}
	switch st.Layer {
	case LayerVirtual:
		return u.cfg.DepsTarget, 0
	case LayerUpper:
		t, err := os.Readlink(u.upperPath(p))
		return t, toErrno(err)
	default:
		b, err := u.cfg.Blobs.Blob(uninterruptible(ctx), st.BlobSHA)
		if err != nil {
			return "", syscall.EIO
		}
		return string(b), 0
	}
}

func (u *Union) childrenLocked(dir string) []DirEntry {
	names := make(map[string]FileType)
	if st, ok := u.upperStat(dir); ok && st.Type == TypeDir {
		if des, err := os.ReadDir(u.upperPath(dir)); err == nil {
			for _, de := range des {
				switch {
				case de.IsDir():
					names[de.Name()] = TypeDir
				case de.Type()&fs.ModeSymlink != 0:
					names[de.Name()] = TypeSymlink
				case de.Type().IsRegular():
					names[de.Name()] = TypeFile
				}
			}
		}
	}
	if e, ok := u.lowerVisibleLocked(dir); ok && e.IsDir() {
		for _, name := range u.lower.Children(dir) {
			if _, ok := names[name]; ok {
				continue
			}
			p := join(dir, name)
			if _, wh := u.whiteouts[p]; wh {
				continue
			}
			ce, _ := u.lower.Lookup(p)
			names[name] = u.lowerStat(p, ce).Type
		}
	}
	if dir == "" {
		names[DepsName] = TypeSymlink
		names[MetaDir] = TypeDir
	}
	out := make([]DirEntry, 0, len(names))
	for n, t := range names {
		out = append(out, DirEntry{Name: n, Type: t, Version: u.versionLocked(join(dir, n), t)})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// ReadDir lists the merged directory and logs it in the readdir set.
func (u *Union) ReadDir(dir string) ([]DirEntry, syscall.Errno) {
	u.mu.RLock()
	defer u.mu.RUnlock()
	if dir == MetaDir {
		return []DirEntry{{Name: inboxName, Type: TypeFile}}, 0
	}
	st, errno := u.statLocked(dir)
	if errno != 0 {
		return nil, errno
	}
	if st.Type != TypeDir {
		return nil, syscall.ENOTDIR
	}
	if !Ignored(dir) {
		u.rsMu.Lock()
		u.readdirs[dir] = struct{}{}
		u.rsMu.Unlock()
	}
	return u.childrenLocked(dir), 0
}

// ReadSource is what an opened read-only file serves from.
type ReadSource struct {
	Stat      Stat
	UpperPath string // set for upper files
	Data      []byte // set for lower blobs and virtual files
}

// OpenRead resolves p for reading and logs it in the read set.
func (u *Union) OpenRead(ctx context.Context, p string) (ReadSource, syscall.Errno) {
	u.mu.RLock()
	defer u.mu.RUnlock()
	st, errno := u.statLocked(p)
	if errno != 0 {
		return ReadSource{}, errno
	}
	if st.Type == TypeDir {
		return ReadSource{}, syscall.EISDIR
	}
	switch st.Layer {
	case LayerVirtual:
		data := u.cfg.Inbox()
		st.Size = int64(len(data))
		return ReadSource{Stat: st, Data: data}, 0
	case LayerUpper:
		u.recordLocked(p)
		return ReadSource{Stat: st, UpperPath: u.upperPath(p)}, 0
	default:
		data, err := u.cfg.Blobs.Blob(uninterruptible(ctx), st.BlobSHA)
		if err != nil {
			return ReadSource{}, syscall.EIO
		}
		u.recordLocked(p)
		return ReadSource{Stat: st, Data: data}, 0
	}
}

// ---- mutations (all hold u.mu exclusively) ----

func (u *Union) ensureUpperParent(p string) syscall.Errno {
	return toErrno(os.MkdirAll(u.upperPath(parentOf(p)), 0o755))
}

// copyUpLocked materializes p in upper (no-op if already there).
func (u *Union) copyUpLocked(ctx context.Context, p string) syscall.Errno {
	if _, ok := u.upperStat(p); ok {
		return 0
	}
	e, ok := u.lowerVisibleLocked(p)
	if !ok {
		return syscall.ENOENT
	}
	return u.materializeLowerLocked(ctx, p, e, p)
}

// materializeLowerLocked writes lower entry e (at src) to upper path dst.
func (u *Union) materializeLowerLocked(ctx context.Context, src string, e gitstore.Entry, dst string) syscall.Errno {
	if errno := u.ensureUpperParent(dst); errno != 0 {
		return errno
	}
	if e.IsDir() {
		return toErrno(os.MkdirAll(u.upperPath(dst), 0o755))
	}
	data, err := u.cfg.Blobs.Blob(uninterruptible(ctx), e.SHA)
	if err != nil {
		return syscall.EIO
	}
	if e.IsSymlink() {
		return toErrno(os.Symlink(string(data), u.upperPath(dst)))
	}
	return toErrno(writeFileAtomic(u.upperPath(dst), data, u.lowerStat(src, e).Perm))
}

func writeFileAtomic(path string, data []byte, perm uint32) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), ".livefs-tmp-*")
	if err != nil {
		return err
	}
	_, werr := tmp.Write(data)
	cerr := tmp.Close()
	if werr == nil {
		werr = cerr
	}
	if werr == nil {
		werr = os.Chmod(tmp.Name(), os.FileMode(perm))
	}
	if werr == nil {
		werr = os.Rename(tmp.Name(), path)
	}
	if werr != nil {
		_ = os.Remove(tmp.Name())
	}
	return werr
}

func (u *Union) checkParentLocked(p string) syscall.Errno {
	if p == "" {
		return syscall.EEXIST
	}
	if Reserved(p) {
		return syscall.EPERM
	}
	st, errno := u.statLocked(parentOf(p))
	if errno != 0 {
		return errno
	}
	if st.Type != TypeDir {
		return syscall.ENOTDIR
	}
	return 0
}

// OpenWrite copies p up (if needed) and opens the upper file with flags.
func (u *Union) OpenWrite(ctx context.Context, p string, flags int) (int, syscall.Errno) {
	if Reserved(p) {
		return -1, syscall.EACCES
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	st, errno := u.statLocked(p)
	if errno != 0 {
		return -1, errno
	}
	if st.Type == TypeDir {
		return -1, syscall.EISDIR
	}
	if errno := u.copyUpLocked(ctx, p); errno != 0 {
		return -1, errno
	}
	fd, err := syscall.Open(u.upperPath(p), flags&^(syscall.O_CREAT|syscall.O_EXCL), 0)
	if err != nil {
		return -1, toErrno(err)
	}
	if flags&syscall.O_ACCMODE == syscall.O_RDWR {
		u.recordLocked(p)
	}
	return fd, 0
}

// Create creates a new regular file and returns an fd opened with flags.
func (u *Union) Create(p string, perm uint32, flags int) (int, Stat, syscall.Errno) {
	u.mu.Lock()
	defer u.mu.Unlock()
	if errno := u.checkParentLocked(p); errno != 0 {
		return -1, Stat{}, errno
	}
	if _, errno := u.statLocked(p); errno == 0 {
		return -1, Stat{}, syscall.EEXIST
	}
	if errno := u.ensureUpperParent(p); errno != 0 {
		return -1, Stat{}, errno
	}
	fd, err := syscall.Open(u.upperPath(p), flags|syscall.O_CREAT|syscall.O_EXCL, perm&0o7777)
	if err != nil {
		return -1, Stat{}, toErrno(err)
	}
	st, _ := u.upperStat(p)
	return fd, st, 0
}

// Mkdir creates a directory in upper.
func (u *Union) Mkdir(p string, perm uint32) (Stat, syscall.Errno) {
	u.mu.Lock()
	defer u.mu.Unlock()
	if errno := u.checkParentLocked(p); errno != 0 {
		return Stat{}, errno
	}
	if _, errno := u.statLocked(p); errno == 0 {
		return Stat{}, syscall.EEXIST
	}
	if errno := u.ensureUpperParent(p); errno != 0 {
		return Stat{}, errno
	}
	if err := os.Mkdir(u.upperPath(p), os.FileMode(perm&0o777)); err != nil {
		return Stat{}, toErrno(err)
	}
	st, _ := u.upperStat(p)
	return st, 0
}

// Symlink creates a symlink in upper.
func (u *Union) Symlink(p, target string) (Stat, syscall.Errno) {
	u.mu.Lock()
	defer u.mu.Unlock()
	if errno := u.checkParentLocked(p); errno != 0 {
		return Stat{}, errno
	}
	if _, errno := u.statLocked(p); errno == 0 {
		return Stat{}, syscall.EEXIST
	}
	if errno := u.ensureUpperParent(p); errno != 0 {
		return Stat{}, errno
	}
	if err := os.Symlink(target, u.upperPath(p)); err != nil {
		return Stat{}, toErrno(err)
	}
	st, _ := u.upperStat(p)
	return st, 0
}

// removeLocked deletes p (file or empty dir) from the merged view.
func (u *Union) removeLocked(p string, st Stat) syscall.Errno {
	_, inLower := u.lowerVisibleLocked(p)
	if st.Layer == LayerUpper || u.hasUpper(p) {
		if err := os.RemoveAll(u.upperPath(p)); err != nil {
			return toErrno(err)
		}
	}
	if inLower {
		u.whiteouts[p] = struct{}{}
	}
	u.dropWhiteoutsBelowLocked(p)
	return 0
}

func (u *Union) hasUpper(p string) bool {
	_, ok := u.upperStat(p)
	return ok
}

func (u *Union) dropWhiteoutsBelowLocked(p string) {
	for w := range u.whiteouts {
		if strings.HasPrefix(w, p+"/") {
			delete(u.whiteouts, w)
		}
	}
}

// Unlink removes a non-directory.
func (u *Union) Unlink(p string) syscall.Errno {
	if Reserved(p) {
		return syscall.EPERM
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	st, errno := u.statLocked(p)
	if errno != 0 {
		return errno
	}
	if st.Type == TypeDir {
		return syscall.EISDIR
	}
	return u.removeLocked(p, st)
}

// Rmdir removes an empty directory.
func (u *Union) Rmdir(p string) syscall.Errno {
	if Reserved(p) || p == "" {
		return syscall.EPERM
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	st, errno := u.statLocked(p)
	if errno != 0 {
		return errno
	}
	if st.Type != TypeDir {
		return syscall.ENOTDIR
	}
	if len(u.childrenLocked(p)) > 0 {
		return syscall.ENOTEMPTY
	}
	return u.removeLocked(p, st)
}

// Rename moves src to dst (copy-up + whiteout for lower content).
func (u *Union) Rename(ctx context.Context, src, dst string, flags uint32) syscall.Errno {
	if Reserved(src) || Reserved(dst) {
		return syscall.EPERM
	}
	if flags&renameExch != 0 {
		return syscall.EINVAL
	}
	if src == dst {
		return 0
	}
	if hasPrefixPath(dst, src) {
		return syscall.EINVAL
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	sst, errno := u.statLocked(src)
	if errno != 0 {
		return errno
	}
	if errno := u.checkParentLocked(dst); errno != 0 {
		return errno
	}
	if dstSt, errno := u.statLocked(dst); errno == 0 {
		if flags&renameNoRepl != 0 {
			return syscall.EEXIST
		}
		switch {
		case dstSt.Type == TypeDir && sst.Type != TypeDir:
			return syscall.EISDIR
		case dstSt.Type != TypeDir && sst.Type == TypeDir:
			return syscall.ENOTDIR
		case dstSt.Type == TypeDir && len(u.childrenLocked(dst)) > 0:
			return syscall.ENOTEMPTY
		}
		if errno := u.removeLocked(dst, dstSt); errno != 0 {
			return errno
		}
	}
	srcLower, srcInLower := u.lowerVisibleLocked(src)
	if errno := u.ensureUpperParent(dst); errno != 0 {
		return errno
	}
	switch {
	case sst.Type == TypeDir && (!srcInLower || sst.Layer == LayerUpper && !srcLower.IsDir()):
		// Purely upper directory: move it as is.
		if err := os.Rename(u.upperPath(src), u.upperPath(dst)); err != nil {
			return toErrno(err)
		}
	case sst.Type == TypeDir:
		// Mixed directory: copy the merged subtree, then drop the upper part.
		if errno := u.copyTreeLocked(ctx, src, dst); errno != 0 {
			return errno
		}
		if err := os.RemoveAll(u.upperPath(src)); err != nil {
			return toErrno(err)
		}
	case sst.Layer == LayerUpper:
		if err := os.Rename(u.upperPath(src), u.upperPath(dst)); err != nil {
			return toErrno(err)
		}
	default:
		if errno := u.materializeLowerLocked(ctx, src, srcLower, dst); errno != 0 {
			return errno
		}
	}
	if sst.Type == TypeDir {
		// The moved directory is complete in upper: make it opaque.
		u.whiteouts[dst] = struct{}{}
	}
	u.dropWhiteoutsBelowLocked(src)
	if srcInLower {
		u.whiteouts[src] = struct{}{}
	}
	return 0
}

// copyTreeLocked copies the merged subtree at src into upper at dst.
func (u *Union) copyTreeLocked(ctx context.Context, src, dst string) syscall.Errno {
	if err := os.MkdirAll(u.upperPath(dst), 0o755); err != nil {
		return toErrno(err)
	}
	for _, de := range u.childrenLocked(src) {
		s, d := join(src, de.Name), join(dst, de.Name)
		st, errno := u.statLocked(s)
		if errno != 0 {
			return errno
		}
		switch {
		case st.Type == TypeDir:
			if errno := u.copyTreeLocked(ctx, s, d); errno != 0 {
				return errno
			}
		case st.Layer == LayerUpper && st.Type == TypeSymlink:
			t, err := os.Readlink(u.upperPath(s))
			if err == nil {
				err = os.Symlink(t, u.upperPath(d))
			}
			if err != nil {
				return toErrno(err)
			}
		case st.Layer == LayerUpper:
			data, err := os.ReadFile(u.upperPath(s))
			if err == nil {
				err = writeFileAtomic(u.upperPath(d), data, st.Perm)
			}
			if err != nil {
				return toErrno(err)
			}
		default:
			e, _ := u.lower.Lookup(s)
			if errno := u.materializeLowerLocked(ctx, s, e, d); errno != 0 {
				return errno
			}
		}
	}
	return 0
}

// Truncate copies p up and truncates it.
func (u *Union) Truncate(ctx context.Context, p string, size int64) syscall.Errno {
	if Reserved(p) {
		return syscall.EPERM
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	if errno := u.copyUpLocked(ctx, p); errno != 0 {
		return errno
	}
	return toErrno(os.Truncate(u.upperPath(p), size))
}

// Chmod copies a file up and changes its permission bits. Lower-only
// directories are left alone (their mode is synthetic).
func (u *Union) Chmod(ctx context.Context, p string, perm uint32) syscall.Errno {
	if Reserved(p) {
		return syscall.EPERM
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	st, errno := u.statLocked(p)
	if errno != 0 {
		return errno
	}
	if st.Type == TypeSymlink || (st.Type == TypeDir && st.Layer != LayerUpper) {
		return 0
	}
	if errno := u.copyUpLocked(ctx, p); errno != 0 {
		return errno
	}
	return toErrno(os.Chmod(u.upperPath(p), os.FileMode(perm&0o7777)))
}

// Chtimes sets times on upper entries; lower entries are left untouched
// (a touch must not count as a write).
func (u *Union) Chtimes(p string, atime, mtime time.Time) syscall.Errno {
	u.mu.Lock()
	defer u.mu.Unlock()
	if _, errno := u.statLocked(p); errno != 0 {
		return errno
	}
	if !u.hasUpper(p) {
		return 0
	}
	if err := os.Chtimes(u.upperPath(p), atime, mtime); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return toErrno(err)
	}
	return 0
}

// ---- overlay inspection and direct upper edits (used by checkpoint) ----

// WriteSet lists paths present in upper (files and symlinks) plus every lower
// file hidden by a whiteout.
func (u *Union) WriteSet() []string {
	u.mu.RLock()
	defer u.mu.RUnlock()
	set := make(map[string]struct{})
	for _, p := range u.upperFilesLocked() {
		set[p] = struct{}{}
	}
	for w := range u.whiteouts {
		for _, p := range u.lower.Files(w) {
			set[p] = struct{}{}
		}
	}
	return sortedKeys(set)
}

func (u *Union) upperFilesLocked() []string {
	var out []string
	root := u.cfg.UpperDir
	_ = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if strings.HasPrefix(d.Name(), ".livefs-tmp-") {
			return nil
		}
		rel, rerr := filepath.Rel(root, path)
		if rerr == nil {
			out = append(out, filepath.ToSlash(rel))
		}
		return nil
	})
	return out
}

// Changes lists upper files that differ from the lower blob (with content)
// and whited-out lower files not replaced in upper (content nil). Symlinks
// are not represented.
func (u *Union) Changes() ([]Change, error) {
	u.mu.RLock()
	defer u.mu.RUnlock()
	byPath := make(map[string]*string)
	for _, p := range u.upperFilesLocked() {
		fi, err := os.Lstat(u.upperPath(p))
		if err != nil || !fi.Mode().IsRegular() {
			continue
		}
		data, err := os.ReadFile(u.upperPath(p))
		if err != nil {
			return nil, err
		}
		if e, ok := u.lowerVisibleLocked(p); ok && e.IsRegular() && e.SHA == gitstore.BlobSHA(data) {
			continue
		}
		s := string(data)
		byPath[p] = &s
	}
	for w := range u.whiteouts {
		for _, p := range u.lower.Files(w) {
			if _, ok := byPath[p]; ok {
				continue
			}
			if fi, err := os.Lstat(u.upperPath(p)); err == nil && !fi.IsDir() {
				continue // replaced in upper (identical content or symlink)
			}
			byPath[p] = nil
		}
	}
	out := make([]Change, 0, len(byPath))
	for p, c := range byPath {
		out = append(out, Change{Path: p, Content: c})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Path < out[j].Path })
	return out, nil
}

// UpperState reports what the overlay holds at p: content if upper has a
// regular file, deleted if the lower file is whited out and not replaced.
func (u *Union) UpperState(p string) (content []byte, inUpper, deleted bool, err error) {
	u.mu.RLock()
	defer u.mu.RUnlock()
	if fi, lerr := os.Lstat(u.upperPath(p)); lerr == nil {
		if !fi.Mode().IsRegular() {
			return nil, true, false, nil
		}
		data, rerr := os.ReadFile(u.upperPath(p))
		return data, true, false, rerr
	}
	return nil, false, u.hiddenLocked(p), nil
}

// WriteUpper replaces p in upper with content (bypassing the mount).
func (u *Union) WriteUpper(p string, content []byte) error {
	u.mu.Lock()
	defer u.mu.Unlock()
	perm := uint32(0o644)
	if fi, err := os.Lstat(u.upperPath(p)); err == nil && fi.Mode().IsRegular() {
		perm = uint32(fi.Mode().Perm())
	} else if err == nil {
		_ = os.RemoveAll(u.upperPath(p))
	}
	if errno := u.ensureUpperParent(p); errno != 0 {
		return errno
	}
	return writeFileAtomic(u.upperPath(p), content, perm)
}

// ResetToLower discards the overlay's version of p so that lowerContent
// (the version in the lower layer the caller is about to swap in; present
// =false means absent) is what the merged view shows. Normally that just
// removes the upper file and p's whiteout; if p sits under a whited-out
// ancestor, the content is written to upper instead.
func (u *Union) ResetToLower(p string, lowerContent []byte, present bool) error {
	u.mu.Lock()
	defer u.mu.Unlock()
	delete(u.whiteouts, p)
	if err := os.Remove(u.upperPath(p)); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	if present && p != "" && u.hiddenLocked(parentOf(p)) {
		if errno := u.ensureUpperParent(p); errno != 0 {
			return errno
		}
		return writeFileAtomic(u.upperPath(p), lowerContent, 0o644)
	}
	return nil
}

// ---- read set ----

// ReadSet returns the files read in the current generation (incl. carry-forward).
func (u *Union) ReadSet() []string {
	u.rsMu.Lock()
	defer u.rsMu.Unlock()
	return sortedKeys(u.reads)
}

// LookupSet returns regular files resolved but not opened in the current
// generation (incl. carry-forward).
func (u *Union) LookupSet() []string {
	u.rsMu.Lock()
	defer u.rsMu.Unlock()
	out := make([]string, 0, len(u.lookups))
	for p := range u.lookups {
		if _, read := u.reads[p]; !read {
			out = append(out, p)
		}
	}
	sort.Strings(out)
	return out
}

// ReaddirSet returns directories listed in the current generation.
func (u *Union) ReaddirSet() []string {
	u.rsMu.Lock()
	defer u.rsMu.Unlock()
	return sortedKeys(u.readdirs)
}

// ResetReadSet clears the read, lookup and readdir sets.
func (u *Union) ResetReadSet() {
	u.rsMu.Lock()
	defer u.rsMu.Unlock()
	u.reads = make(map[string]struct{})
	u.lookups = make(map[string]struct{})
	u.readdirs = make(map[string]struct{})
}

// Advance atomically switches the lower layer, bumps the generation, and
// drops delta paths from the read/lookup/readdir sets (others carry forward).
func (u *Union) Advance(lower Lower, delta []string) uint64 {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.lower = lower
	u.gen++
	now := time.Now()
	u.rsMu.Lock()
	for _, p := range delta {
		u.mtimes[p] = now
		u.versions[p] = u.gen
		delete(u.reads, p)
		delete(u.lookups, p)
		for d := parentOf(p); ; d = parentOf(d) {
			u.mtimes[d] = now
			delete(u.readdirs, d)
			if d == "" {
				break
			}
		}
	}
	u.rsMu.Unlock()
	return u.gen
}

func sortedKeys(m map[string]struct{}) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func toErrno(err error) syscall.Errno {
	if err == nil {
		return 0
	}
	var errno syscall.Errno
	if errors.As(err, &errno) {
		return errno
	}
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return syscall.ENOENT
	case errors.Is(err, fs.ErrExist):
		return syscall.EEXIST
	case errors.Is(err, fs.ErrPermission):
		return syscall.EACCES
	}
	return syscall.EIO
}

// uninterruptible detaches a FUSE request context from cancellation for local object
// reads. The kernel interrupts a request whenever the calling thread gets a signal
// (e.g. Go's preemption signal); a local blob read takes microseconds, and failing it
// would surface as EIO to the caller.
func uninterruptible(ctx context.Context) context.Context {
	return context.WithoutCancel(ctx)
}
