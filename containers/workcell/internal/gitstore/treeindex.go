package gitstore

import (
	"bytes"
	"fmt"
	"path"
	"sort"
	"strconv"
	"strings"
)

// Object types in a tree.
const (
	TypeBlob   = "blob"
	TypeTree   = "tree"
	TypeCommit = "commit" // submodule gitlink; exposed as an empty directory
)

// Git modes.
const (
	ModeFile    = 0o100644
	ModeExec    = 0o100755
	ModeSymlink = 0o120000
	ModeTree    = 0o040000
	ModeGitlink = 0o160000
)

// Entry is one path in a commit's tree.
type Entry struct {
	Mode uint32 // git mode, e.g. 0o100644
	Type string // blob | tree | commit
	SHA  string
	Size int64 // blobs only
}

// IsDir reports whether the entry is a directory (tree or gitlink).
func (e Entry) IsDir() bool { return e.Type == TypeTree || e.Type == TypeCommit }

// IsSymlink reports whether the entry is a symlink blob.
func (e Entry) IsSymlink() bool { return e.Type == TypeBlob && e.Mode == ModeSymlink }

// IsRegular reports whether the entry is a regular file blob.
func (e Entry) IsRegular() bool { return e.Type == TypeBlob && e.Mode != ModeSymlink }

// TreeIndex is an immutable path index of one commit, built from
// `git ls-tree -r -t -l -z`. The root directory is the empty path "".
type TreeIndex struct {
	commit   string
	entries  map[string]Entry
	children map[string][]string // dir -> sorted child names
}

// NewTreeIndex builds an index from explicit entries (missing parent
// directories are synthesized). Used by ParseLsTree and tests.
func NewTreeIndex(commit string, entries map[string]Entry) *TreeIndex {
	t := &TreeIndex{
		commit:   commit,
		entries:  make(map[string]Entry, len(entries)+1),
		children: make(map[string][]string),
	}
	t.entries[""] = Entry{Mode: ModeTree, Type: TypeTree}
	for p, e := range entries {
		t.entries[p] = e
		for dir := path.Dir(p); ; dir = path.Dir(dir) {
			if dir == "." {
				dir = ""
			}
			if _, ok := t.entries[dir]; !ok {
				t.entries[dir] = Entry{Mode: ModeTree, Type: TypeTree}
			}
			if dir == "" {
				break
			}
		}
	}
	seen := make(map[string]map[string]bool)
	for p := range t.entries {
		if p == "" {
			continue
		}
		dir, name := splitPath(p)
		if seen[dir] == nil {
			seen[dir] = make(map[string]bool)
		}
		if !seen[dir][name] {
			seen[dir][name] = true
			t.children[dir] = append(t.children[dir], name)
		}
	}
	for _, names := range t.children {
		sort.Strings(names)
	}
	return t
}

// ParseLsTree parses `git ls-tree -r -t -l -z` output.
func ParseLsTree(commit string, out []byte) (*TreeIndex, error) {
	entries := make(map[string]Entry)
	for _, rec := range bytes.Split(out, []byte{0}) {
		if len(rec) == 0 {
			continue
		}
		tab := bytes.IndexByte(rec, '\t')
		if tab < 0 {
			return nil, fmt.Errorf("ls-tree: malformed record %q", rec)
		}
		meta := strings.Fields(string(rec[:tab]))
		if len(meta) != 4 {
			return nil, fmt.Errorf("ls-tree: malformed meta %q", rec[:tab])
		}
		mode, err := strconv.ParseUint(meta[0], 8, 32)
		if err != nil {
			return nil, fmt.Errorf("ls-tree: bad mode %q", meta[0])
		}
		var size int64
		if meta[3] != "-" {
			if size, err = strconv.ParseInt(meta[3], 10, 64); err != nil {
				return nil, fmt.Errorf("ls-tree: bad size %q", meta[3])
			}
		}
		entries[string(rec[tab+1:])] = Entry{Mode: uint32(mode), Type: meta[1], SHA: meta[2], Size: size}
	}
	return NewTreeIndex(commit, entries), nil
}

// Commit returns the commit sha this index describes.
func (t *TreeIndex) Commit() string { return t.commit }

// Lookup returns the entry at p ("" = root).
func (t *TreeIndex) Lookup(p string) (Entry, bool) {
	e, ok := t.entries[p]
	return e, ok
}

// Children returns the sorted child names of dir (nil if dir is not a tree).
func (t *TreeIndex) Children(dir string) []string { return t.children[dir] }

// Files returns all non-directory paths at or below prefix ("" = all), sorted.
func (t *TreeIndex) Files(prefix string) []string {
	var out []string
	if e, ok := t.entries[prefix]; ok && !e.IsDir() {
		return []string{prefix}
	}
	var walk func(dir string)
	walk = func(dir string) {
		for _, name := range t.children[dir] {
			p := Join(dir, name)
			e := t.entries[p]
			if e.Type == TypeTree {
				walk(p)
			} else if e.Type == TypeBlob {
				out = append(out, p)
			}
		}
	}
	walk(prefix)
	sort.Strings(out)
	return out
}

// Len returns the number of entries (including the root).
func (t *TreeIndex) Len() int { return len(t.entries) }

// Join joins a repo dir and a name ("" is the root).
func Join(dir, name string) string {
	if dir == "" {
		return name
	}
	return dir + "/" + name
}

func splitPath(p string) (dir, name string) {
	i := strings.LastIndexByte(p, '/')
	if i < 0 {
		return "", p
	}
	return p[:i], p[i+1:]
}
