package gitstore

import (
	"bytes"
	"container/list"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// Mirror is the shared bare object store of a workcell. All workspaces read
// lower-layer trees and blobs from it; nothing is ever checked out.
type Mirror struct {
	Dir string

	fetchMu sync.Mutex
	cat     *catFile

	idxMu   sync.Mutex
	indexes map[string]*TreeIndex
	idxLRU  *list.List // of commit sha, front = most recent
	pinned  map[string]int

	blobs *blobCache
}

const maxUnpinnedIndexes = 32

// OpenMirror opens (initializing if needed) a bare mirror at dir.
func OpenMirror(ctx context.Context, dir string) (*Mirror, error) {
	if _, err := os.Stat(filepath.Join(dir, "HEAD")); err != nil {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, err
		}
		if _, err := Git(ctx, "", "init", "--bare", "-q", dir); err != nil {
			return nil, err
		}
	}
	// Never prune: workspaces and clones (via alternates) depend on old objects.
	for _, kv := range [][2]string{{"gc.auto", "0"}, {"gc.pruneExpire", "never"}, {"core.logAllRefUpdates", "false"}} {
		if _, err := Git(ctx, dir, "config", kv[0], kv[1]); err != nil {
			return nil, err
		}
	}
	return &Mirror{
		Dir:     dir,
		cat:     newCatFile(dir),
		indexes: make(map[string]*TreeIndex),
		idxLRU:  list.New(),
		pinned:  make(map[string]int),
		blobs:   newBlobCache(256 << 20),
	}, nil
}

// Close stops background processes.
func (m *Mirror) Close() { m.cat.Close() }

// Git runs a git command inside the mirror.
func (m *Mirror) Git(ctx context.Context, args ...string) (string, error) {
	return Git(ctx, m.Dir, args...)
}

// HasCommit reports whether sha names a commit present in the mirror.
func (m *Mirror) HasCommit(ctx context.Context, sha string) bool {
	if !IsSHA(sha) {
		return false
	}
	_, err := Run(ctx, Cmd{Dir: m.Dir, Args: []string{"cat-file", "-e", sha + "^{commit}"}})
	return err == nil
}

// remoteKey namespaces fetched refs per remote URL.
func remoteKey(remote string) string {
	h := sha1.Sum([]byte(remote))
	return hex.EncodeToString(h[:6])
}

// Fetch makes sure each sha is present, fetching from remote if needed.
// It first fetches all branch heads, then (if still missing) the sha itself.
func (m *Mirror) Fetch(ctx context.Context, remote string, shas ...string) error {
	missing := func() []string {
		var out []string
		for _, s := range shas {
			if s != "" && !m.HasCommit(ctx, s) {
				out = append(out, s)
			}
		}
		return out
	}
	for _, s := range shas {
		if s != "" && !IsSHA(s) {
			return fmt.Errorf("invalid sha %q", s)
		}
	}
	if len(missing()) == 0 {
		return nil
	}
	if remote == "" {
		return fmt.Errorf("commit(s) %v not in mirror and no remote given", missing())
	}
	m.fetchMu.Lock()
	defer m.fetchMu.Unlock()
	if len(missing()) == 0 {
		return nil
	}
	refspec := fmt.Sprintf("+refs/heads/*:refs/livemain/remotes/%s/*", remoteKey(remote))
	if _, err := Run(ctx, Cmd{Dir: m.Dir, Args: []string{"fetch", "-q", "--no-tags", remote, refspec}}); err != nil {
		return fmt.Errorf("fetch %s: %w", remote, err)
	}
	if rest := missing(); len(rest) > 0 {
		args := append([]string{"fetch", "-q", "--no-tags", remote}, rest...)
		if _, err := Run(ctx, Cmd{Dir: m.Dir, Args: args}); err != nil {
			return fmt.Errorf("commit(s) %v not found on %s: %w", rest, remote, err)
		}
		// Keep them reachable from a ref so nothing ever considers them garbage.
		for _, s := range rest {
			_, _ = m.Git(ctx, "update-ref", "refs/livemain/fetched/"+s, s)
		}
	}
	if rest := missing(); len(rest) > 0 {
		return fmt.Errorf("commit(s) %v not found on %s", rest, remote)
	}
	return nil
}

// RemoteRef returns the sha of ref on remote ("" if it does not exist).
func (m *Mirror) RemoteRef(ctx context.Context, remote, ref string) (string, error) {
	out, err := Run(ctx, Cmd{Dir: m.Dir, Args: []string{"ls-remote", remote, ref}})
	if err != nil {
		return "", fmt.Errorf("ls-remote %s: %w", remote, err)
	}
	for _, line := range strings.Split(string(out), "\n") {
		f := strings.Fields(line)
		if len(f) == 2 && f[1] == ref {
			return f[0], nil
		}
	}
	return "", nil
}

// Pin records a ref so the commit is protected and its index kept warm.
func (m *Mirror) Pin(ctx context.Context, name, sha string) error {
	_, err := m.Git(ctx, "update-ref", "refs/livemain/pins/"+name, sha)
	return err
}

// Unpin removes a pin ref.
func (m *Mirror) Unpin(ctx context.Context, name string) {
	_, _ = m.Git(ctx, "update-ref", "-d", "refs/livemain/pins/"+name)
}

// Index returns the path index of commit sha (cached).
func (m *Mirror) Index(ctx context.Context, sha string) (*TreeIndex, error) {
	if !IsSHA(sha) {
		return nil, fmt.Errorf("invalid sha %q", sha)
	}
	m.idxMu.Lock()
	if t, ok := m.indexes[sha]; ok {
		m.touchLocked(sha)
		m.idxMu.Unlock()
		return t, nil
	}
	m.idxMu.Unlock()

	out, err := Run(ctx, Cmd{Dir: m.Dir, Args: []string{"ls-tree", "-r", "-t", "-l", "-z", sha}})
	if err != nil {
		return nil, fmt.Errorf("ls-tree %s: %w", sha, err)
	}
	t, err := ParseLsTree(sha, out)
	if err != nil {
		return nil, err
	}
	m.idxMu.Lock()
	defer m.idxMu.Unlock()
	if existing, ok := m.indexes[sha]; ok {
		return existing, nil
	}
	m.indexes[sha] = t
	m.idxLRU.PushFront(sha)
	m.evictLocked()
	return t, nil
}

// HoldIndex marks sha's index as in use (not evictable) until ReleaseIndex.
func (m *Mirror) HoldIndex(sha string) {
	m.idxMu.Lock()
	m.pinned[sha]++
	m.idxMu.Unlock()
}

// ReleaseIndex undoes HoldIndex.
func (m *Mirror) ReleaseIndex(sha string) {
	m.idxMu.Lock()
	if m.pinned[sha]--; m.pinned[sha] <= 0 {
		delete(m.pinned, sha)
	}
	m.evictLocked()
	m.idxMu.Unlock()
}

func (m *Mirror) touchLocked(sha string) {
	for e := m.idxLRU.Front(); e != nil; e = e.Next() {
		if e.Value.(string) == sha {
			m.idxLRU.MoveToFront(e)
			return
		}
	}
}

func (m *Mirror) evictLocked() {
	unpinned := 0
	for e := m.idxLRU.Front(); e != nil; {
		next := e.Next()
		sha := e.Value.(string)
		if m.pinned[sha] == 0 {
			unpinned++
			if unpinned > maxUnpinnedIndexes {
				delete(m.indexes, sha)
				m.idxLRU.Remove(e)
			}
		}
		e = next
	}
}

// Blob returns the content of a blob (cached).
func (m *Mirror) Blob(ctx context.Context, sha string) ([]byte, error) {
	if b, ok := m.blobs.get(sha); ok {
		return b, nil
	}
	typ, data, err := m.cat.Read(ctx, sha)
	if err != nil {
		return nil, err
	}
	if typ != TypeBlob {
		return nil, fmt.Errorf("object %s is a %s, not a blob", sha, typ)
	}
	m.blobs.put(sha, data)
	return data, nil
}

// ReadFile returns the content of path at commit; ok=false if absent or not a file.
func (m *Mirror) ReadFile(ctx context.Context, commit, p string) ([]byte, bool, error) {
	idx, err := m.Index(ctx, commit)
	if err != nil {
		return nil, false, err
	}
	e, ok := idx.Lookup(p)
	if !ok || e.Type != TypeBlob {
		return nil, false, nil
	}
	b, err := m.Blob(ctx, e.SHA)
	if err != nil {
		return nil, false, err
	}
	return b, true, nil
}

// DiffNames lists paths changed between two commits (no rename detection).
func (m *Mirror) DiffNames(ctx context.Context, from, to string) ([]string, error) {
	if from == to {
		return nil, nil
	}
	out, err := Run(ctx, Cmd{Dir: m.Dir, Args: []string{"diff-tree", "-r", "--name-only", "--no-renames", "-z", from, to}})
	if err != nil {
		return nil, fmt.Errorf("diff-tree: %w", err)
	}
	var paths []string
	for _, p := range bytes.Split(out, []byte{0}) {
		if len(p) > 0 {
			paths = append(paths, string(p))
		}
	}
	return paths, nil
}

// UnifiedDiff returns `git diff from to -- path`, truncated to max bytes.
func (m *Mirror) UnifiedDiff(ctx context.Context, from, to, p string, max int) string {
	out, err := Run(ctx, Cmd{Dir: m.Dir, Args: []string{"diff", "--no-color", "--no-ext-diff", "--no-renames", from, to, "--", p}})
	if err != nil {
		return ""
	}
	return Truncate(string(out), max)
}

// Truncate cuts s to at most max bytes on a line boundary when possible.
func Truncate(s string, max int) string {
	if max <= 0 || len(s) <= max {
		return s
	}
	cut := s[:max]
	if i := strings.LastIndexByte(cut, '\n'); i > max/2 {
		cut = cut[:i+1]
	}
	return cut + "... (truncated)\n"
}

// BlobSHA computes the git (SHA-1) blob id of content.
func BlobSHA(content []byte) string {
	h := sha1.New()
	fmt.Fprintf(h, "blob %d\x00", len(content))
	h.Write(content)
	return hex.EncodeToString(h.Sum(nil))
}

// HashObject writes content as a blob into the mirror and returns its id.
func (m *Mirror) HashObject(ctx context.Context, content []byte) (string, error) {
	out, err := Run(ctx, Cmd{Dir: m.Dir, Stdin: bytes.NewReader(content), Args: []string{"hash-object", "-w", "--stdin"}})
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

// IsNotFound reports whether err means a missing object.
func IsNotFound(err error) bool { return errors.Is(err, ErrMissing) }
