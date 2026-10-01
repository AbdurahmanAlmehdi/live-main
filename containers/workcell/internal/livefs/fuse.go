package livefs

import (
	"context"
	"fmt"
	"hash/fnv"
	"os"
	"strings"
	"syscall"
	"time"

	"github.com/hanwen/go-fuse/v2/fs"
	"github.com/hanwen/go-fuse/v2/fuse"
)

// DefaultKernelTimeout is the entry/attr/negative cache TTL handed to the
// kernel. Generation swaps additionally invalidate every delta path
// explicitly, so the TTL is only a safety net.
const DefaultKernelTimeout = time.Second

// MountOptions tunes a mount.
type MountOptions struct {
	Debug bool
	// KernelTimeout overrides DefaultKernelTimeout when > 0.
	KernelTimeout time.Duration
	// DirectIO disables the kernel page cache for file handles. Off by
	// default: inode numbers change whenever a path changes across a swap,
	// so cached pages are always for immutable content.
	DirectIO bool
}

// Mount is a live FUSE mount of a Union.
type Mount struct {
	U      *Union
	Dir    string
	server *fuse.Server
	root   *node
	uid    uint32
	gid    uint32
	opts   MountOptions
}

// MountUnion mounts u at dir and waits until the mount is ready.
func MountUnion(dir string, u *Union, mo MountOptions) (*Mount, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	m := &Mount{U: u, Dir: dir, uid: uint32(os.Getuid()), gid: uint32(os.Getgid()), opts: mo}
	m.root = &node{m: m}
	timeout := DefaultKernelTimeout
	if mo.KernelTimeout > 0 {
		timeout = mo.KernelTimeout
	}
	opts := &fs.Options{
		MountOptions: fuse.MountOptions{
			FsName:               "livefs",
			Name:                 "livefs",
			AllowOther:           os.Getuid() == 0,
			DisableXAttrs:        true,
			DisableReadDirPlus:   true, // readdirplus would Lookup (and log) every entry
			DirectMount:          true,
			MaxBackground:        64,
			EnableSymlinkCaching: true,
			Debug:                mo.Debug,
		},
		EntryTimeout:    &timeout,
		AttrTimeout:     &timeout,
		NegativeTimeout: &timeout,
		UID:             m.uid,
		GID:             m.gid,
	}
	// go-fuse opens a file on the fresh mount while it starts (its epoll workaround). A fork
	// in another goroutine during that window would hand the child an fd on our own mount;
	// the child's pre-exec dup3/close then sends FLUSH to this very server, which can
	// deadlock against a stop-the-world GC waiting on the forking thread. Holding ForkLock
	// keeps forks out of that window. Only safe with strict direct mounting: a fusermount
	// fallback would fork while we hold the lock.
	var server *fuse.Server
	var err error
	if os.Geteuid() == 0 {
		opts.MountOptions.DirectMountStrict = true
		syscall.ForkLock.RLock()
		server, err = fs.Mount(dir, m.root, opts)
		syscall.ForkLock.RUnlock()
	} else {
		server, err = fs.Mount(dir, m.root, opts)
	}
	if err != nil {
		return nil, fmt.Errorf("mount %s: %w", dir, err)
	}
	m.server = server
	return m, nil
}

// Unmount detaches the filesystem (lazily if busy).
func (m *Mount) Unmount() error {
	if err := m.server.Unmount(); err != nil {
		if lerr := LazyUnmount(m.Dir); lerr != nil {
			return fmt.Errorf("unmount %s: %v (lazy: %v)", m.Dir, err, lerr)
		}
	}
	return nil
}

// Advance swaps the lower layer to lower and invalidates kernel caches for
// every delta path (entries along the path and the inodes' content/attrs).
func (m *Mount) Advance(lower Lower, delta []string) uint64 {
	gen := m.U.Advance(lower, delta)
	m.Invalidate(delta)
	return gen
}

// Invalidate drops kernel dentry/attr/page caches for paths. Must not be
// called while holding Union locks (the kernel may call back into us).
func (m *Mount) Invalidate(paths []string) {
	rootIno := m.root.EmbeddedInode()
	entryDone := make(map[string]bool)
	contentDone := make(map[*fs.Inode]bool)
	notifyContent := func(n *fs.Inode) {
		if !contentDone[n] {
			contentDone[n] = true
			_ = n.NotifyContent(0, 0)
		}
	}
	for _, p := range paths {
		cur := rootIno
		notifyContent(cur)
		prefix := ""
		for _, c := range strings.Split(p, "/") {
			prefix = join(prefix, c)
			if !entryDone[prefix] {
				entryDone[prefix] = true
				_ = cur.NotifyEntry(c)
			}
			child := cur.GetChild(c)
			if child == nil {
				break
			}
			notifyContent(child)
			cur = child
		}
	}
}

// ---- nodes ----

type node struct {
	fs.Inode
	m *Mount
}

var (
	_ fs.NodeLookuper   = (*node)(nil)
	_ fs.NodeGetattrer  = (*node)(nil)
	_ fs.NodeSetattrer  = (*node)(nil)
	_ fs.NodeOpener     = (*node)(nil)
	_ fs.NodeCreater    = (*node)(nil)
	_ fs.NodeMkdirer    = (*node)(nil)
	_ fs.NodeSymlinker  = (*node)(nil)
	_ fs.NodeUnlinker   = (*node)(nil)
	_ fs.NodeRmdirer    = (*node)(nil)
	_ fs.NodeRenamer    = (*node)(nil)
	_ fs.NodeReadlinker = (*node)(nil)
	_ fs.NodeReaddirer  = (*node)(nil)
	_ fs.NodeStatfser   = (*node)(nil)
)

// repoPath computes the node's repo-relative path; ok=false if orphaned.
func (n *node) repoPath() (string, bool) {
	root := n.m.root.EmbeddedInode()
	cur := n.EmbeddedInode()
	var segs []string
	for cur != root {
		name, parent := cur.Parent()
		if parent == nil {
			return "", false
		}
		segs = append(segs, name)
		cur = parent
	}
	for i, j := 0, len(segs)-1; i < j; i, j = i+1, j-1 {
		segs[i], segs[j] = segs[j], segs[i]
	}
	return strings.Join(segs, "/"), true
}

func (n *node) childPath(name string) (string, syscall.Errno) {
	p, ok := n.repoPath()
	if !ok {
		return "", syscall.ENOENT
	}
	return join(p, name), 0
}

func typeMode(t FileType) uint32 {
	switch t {
	case TypeDir:
		return syscall.S_IFDIR
	case TypeSymlink:
		return syscall.S_IFLNK
	default:
		return syscall.S_IFREG
	}
}

// inoFor derives an inode number from path, type and version.
func inoFor(p string, t FileType, version uint64) uint64 {
	if p == "" {
		return 1
	}
	h := fnv.New64a()
	h.Write([]byte(p))
	h.Write([]byte{0, byte(t)})
	var v [8]byte
	for i := range v {
		v[i] = byte(version >> (8 * i))
	}
	h.Write(v[:])
	ino := h.Sum64()
	if ino <= 1 {
		ino += 2
	}
	return ino
}

func (m *Mount) fillAttr(out *fuse.Attr, p string, st Stat) {
	out.Ino = inoFor(p, st.Type, st.Version)
	out.Mode = typeMode(st.Type) | st.Perm
	out.Size = uint64(st.Size)
	out.Blocks = (out.Size + 511) / 512
	out.Blksize = 4096
	out.Nlink = 1
	if st.Type == TypeDir {
		out.Nlink = 2
	}
	out.Owner = fuse.Owner{Uid: m.uid, Gid: m.gid}
	out.SetTimes(&st.Mtime, &st.Mtime, &st.Mtime)
}

func (n *node) newChild(ctx context.Context, p string, st Stat, out *fuse.EntryOut) *fs.Inode {
	n.m.fillAttr(&out.Attr, p, st)
	child := &node{m: n.m}
	return n.NewInode(ctx, child, fs.StableAttr{Mode: typeMode(st.Type), Ino: inoFor(p, st.Type, st.Version)})
}

func (n *node) Lookup(ctx context.Context, name string, out *fuse.EntryOut) (*fs.Inode, syscall.Errno) {
	p, errno := n.childPath(name)
	if errno != 0 {
		return nil, errno
	}
	st, errno := n.m.U.Lookup(p)
	if errno != 0 {
		return nil, errno
	}
	return n.newChild(ctx, p, st, out), 0
}

func (n *node) Getattr(ctx context.Context, f fs.FileHandle, out *fuse.AttrOut) syscall.Errno {
	p, ok := n.repoPath()
	if ok {
		st, errno := n.m.U.Stat(p)
		// A node whose inode number no longer matches its path's current
		// version was swapped away; it only lives on through open handles.
		if errno == 0 && (n.IsRoot() || inoFor(p, st.Type, st.Version) == n.StableAttr().Ino) {
			n.m.fillAttr(&out.Attr, p, st)
			return 0
		}
	}
	if fg, ok := f.(fs.FileGetattrer); ok {
		return fg.Getattr(ctx, out)
	}
	if ok {
		if st, errno := n.m.U.Stat(p); errno == 0 {
			n.m.fillAttr(&out.Attr, p, st)
			return 0
		}
	}
	return syscall.ENOENT
}

func (n *node) Setattr(ctx context.Context, f fs.FileHandle, in *fuse.SetAttrIn, out *fuse.AttrOut) syscall.Errno {
	p, ok := n.repoPath()
	if !ok {
		if fsa, ok := f.(fs.FileSetattrer); ok {
			return fsa.Setattr(ctx, in, out)
		}
		return syscall.ENOENT
	}
	u := n.m.U
	if sz, ok := in.GetSize(); ok {
		if errno := u.Truncate(ctx, p, int64(sz)); errno != 0 {
			return errno
		}
	}
	if mode, ok := in.GetMode(); ok {
		if errno := u.Chmod(ctx, p, mode); errno != 0 {
			return errno
		}
	}
	mtime, mok := in.GetMTime()
	atime, aok := in.GetATime()
	if mok || aok {
		if !mok {
			mtime = time.Now()
		}
		if !aok {
			atime = mtime
		}
		if errno := u.Chtimes(p, atime, mtime); errno != 0 {
			return errno
		}
	}
	return n.Getattr(ctx, f, out)
}

// openFlags: by default keep the page cache across opens. Content per
// inode is immutable for lower files (a swap changes the inode number) and
// coherent for upper files (all writes go through this mount).
func (m *Mount) openFlags() uint32 {
	if m.opts.DirectIO {
		return fuse.FOPEN_DIRECT_IO
	}
	return fuse.FOPEN_KEEP_CACHE
}

func (n *node) Open(ctx context.Context, flags uint32) (fs.FileHandle, uint32, syscall.Errno) {
	p, ok := n.repoPath()
	if !ok {
		return nil, 0, syscall.ENOENT
	}
	u := n.m.U
	acc := int(flags) & syscall.O_ACCMODE
	if acc != syscall.O_RDONLY || int(flags)&syscall.O_TRUNC != 0 {
		fd, errno := u.OpenWrite(ctx, p, int(flags))
		if errno != 0 {
			return nil, 0, errno
		}
		return fs.NewLoopbackFile(fd), n.m.openFlags(), 0
	}
	src, errno := u.OpenRead(ctx, p)
	if errno != 0 {
		return nil, 0, errno
	}
	if src.UpperPath != "" {
		fd, err := syscall.Open(src.UpperPath, int(flags)&^(syscall.O_CREAT|syscall.O_EXCL|syscall.O_TRUNC), 0)
		if err != nil {
			return nil, 0, toErrno(err)
		}
		return fs.NewLoopbackFile(fd), n.m.openFlags(), 0
	}
	f := &dataFile{data: src.Data}
	n.m.fillAttr(&f.attr, p, src.Stat)
	f.attr.Size = uint64(len(src.Data))
	if src.Stat.Layer == LayerVirtual {
		return f, fuse.FOPEN_DIRECT_IO, 0 // the inbox changes in place
	}
	return f, n.m.openFlags(), 0
}

func (n *node) Create(ctx context.Context, name string, flags uint32, mode uint32, out *fuse.EntryOut) (*fs.Inode, fs.FileHandle, uint32, syscall.Errno) {
	p, errno := n.childPath(name)
	if errno != 0 {
		return nil, nil, 0, errno
	}
	fd, st, errno := n.m.U.Create(p, mode, int(flags))
	if errno != 0 {
		return nil, nil, 0, errno
	}
	return n.newChild(ctx, p, st, out), fs.NewLoopbackFile(fd), n.m.openFlags(), 0
}

func (n *node) Mkdir(ctx context.Context, name string, mode uint32, out *fuse.EntryOut) (*fs.Inode, syscall.Errno) {
	p, errno := n.childPath(name)
	if errno != 0 {
		return nil, errno
	}
	st, errno := n.m.U.Mkdir(p, mode)
	if errno != 0 {
		return nil, errno
	}
	return n.newChild(ctx, p, st, out), 0
}

func (n *node) Symlink(ctx context.Context, target, name string, out *fuse.EntryOut) (*fs.Inode, syscall.Errno) {
	p, errno := n.childPath(name)
	if errno != 0 {
		return nil, errno
	}
	st, errno := n.m.U.Symlink(p, target)
	if errno != 0 {
		return nil, errno
	}
	return n.newChild(ctx, p, st, out), 0
}

func (n *node) Unlink(ctx context.Context, name string) syscall.Errno {
	p, errno := n.childPath(name)
	if errno != 0 {
		return errno
	}
	return n.m.U.Unlink(p)
}

func (n *node) Rmdir(ctx context.Context, name string) syscall.Errno {
	p, errno := n.childPath(name)
	if errno != 0 {
		return errno
	}
	return n.m.U.Rmdir(p)
}

func (n *node) Rename(ctx context.Context, name string, newParent fs.InodeEmbedder, newName string, flags uint32) syscall.Errno {
	src, errno := n.childPath(name)
	if errno != 0 {
		return errno
	}
	np, ok := newParent.(*node)
	if !ok {
		return syscall.EXDEV
	}
	dst, errno := np.childPath(newName)
	if errno != 0 {
		return errno
	}
	return n.m.U.Rename(ctx, src, dst, flags)
}

func (n *node) Readlink(ctx context.Context) ([]byte, syscall.Errno) {
	p, ok := n.repoPath()
	if !ok {
		return nil, syscall.ENOENT
	}
	t, errno := n.m.U.Readlink(ctx, p)
	return []byte(t), errno
}

func (n *node) Readdir(ctx context.Context) (fs.DirStream, syscall.Errno) {
	p, ok := n.repoPath()
	if !ok {
		return nil, syscall.ENOENT
	}
	entries, errno := n.m.U.ReadDir(p)
	if errno != 0 {
		return nil, errno
	}
	list := make([]fuse.DirEntry, 0, len(entries))
	for _, e := range entries {
		list = append(list, fuse.DirEntry{Name: e.Name, Mode: typeMode(e.Type), Ino: inoFor(join(p, e.Name), e.Type, e.Version)})
	}
	return fs.NewListDirStream(list), 0
}

func (n *node) Statfs(ctx context.Context, out *fuse.StatfsOut) syscall.Errno {
	var st syscall.Statfs_t
	if err := syscall.Statfs(n.m.U.UpperDir(), &st); err != nil {
		return toErrno(err)
	}
	out.FromStatfsT(&st)
	return 0
}

// ---- handles ----

// dataFile serves an immutable snapshot (a lower blob or the inbox). It
// keeps serving the content it was opened with across generation swaps.
type dataFile struct {
	data []byte
	attr fuse.Attr
}

var (
	_ fs.FileReader    = (*dataFile)(nil)
	_ fs.FileGetattrer = (*dataFile)(nil)
)

func (f *dataFile) Read(ctx context.Context, dest []byte, off int64) (fuse.ReadResult, syscall.Errno) {
	if off >= int64(len(f.data)) {
		return fuse.ReadResultData(nil), 0
	}
	end := off + int64(len(dest))
	if end > int64(len(f.data)) {
		end = int64(len(f.data))
	}
	return fuse.ReadResultData(f.data[off:end]), 0
}

func (f *dataFile) Getattr(ctx context.Context, out *fuse.AttrOut) syscall.Errno {
	out.Attr = f.attr
	return 0
}
