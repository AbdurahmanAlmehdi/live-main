package livefs

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"syscall"
	"testing"

	"livemain/workcell/internal/gitstore"
)

// memBlobs is an in-memory BlobSource keyed by git blob id.
type memBlobs map[string][]byte

func (m memBlobs) Blob(_ context.Context, sha string) ([]byte, error) {
	b, ok := m[sha]
	if !ok {
		return nil, fmt.Errorf("%s: %w", sha, gitstore.ErrMissing)
	}
	return b, nil
}

// lowerOf builds a TreeIndex from path → content (registering blobs).
func lowerOf(blobs memBlobs, commit string, files map[string]string) *gitstore.TreeIndex {
	entries := make(map[string]gitstore.Entry, len(files))
	for p, c := range files {
		sha := gitstore.BlobSHA([]byte(c))
		blobs[sha] = []byte(c)
		entries[p] = gitstore.Entry{Mode: gitstore.ModeFile, Type: gitstore.TypeBlob, SHA: sha, Size: int64(len(c))}
	}
	return gitstore.NewTreeIndex(commit, entries)
}

func newTestUnion(t *testing.T, files map[string]string) (*Union, memBlobs) {
	t.Helper()
	blobs := memBlobs{}
	u, err := NewUnion(Config{UpperDir: t.TempDir(), DepsTarget: "/deps/node_modules", Blobs: blobs}, lowerOf(blobs, "c1", files))
	if err != nil {
		t.Fatal(err)
	}
	return u, blobs
}

var base = map[string]string{
	"package.json":         "{}\n",
	"src/core/value.ts":    "export type Value = number;\n",
	"src/core/registry.ts": "export const registry = {\n};\n",
	"src/eval/evaluate.ts": "eval\n",
	"tests/a.test.ts":      "test\n",
}

func names(es []DirEntry) []string {
	out := make([]string, len(es))
	for i, e := range es {
		out[i] = e.Name
	}
	return out
}

func readMerged(t *testing.T, u *Union, p string) string {
	t.Helper()
	src, errno := u.OpenRead(context.Background(), p)
	if errno != 0 {
		t.Fatalf("OpenRead(%s): %v", p, errno)
	}
	if src.UpperPath != "" {
		b, err := os.ReadFile(src.UpperPath)
		if err != nil {
			t.Fatal(err)
		}
		return string(b)
	}
	return string(src.Data)
}

func writeVia(t *testing.T, u *Union, p, content string) {
	t.Helper()
	var fd int
	var errno syscall.Errno
	if _, e := u.Stat(p); e == syscall.ENOENT {
		fd, _, errno = u.Create(p, 0o644, syscall.O_WRONLY)
	} else {
		fd, errno = u.OpenWrite(context.Background(), p, syscall.O_WRONLY|syscall.O_TRUNC)
	}
	if errno != 0 {
		t.Fatalf("open %s for write: %v", p, errno)
	}
	f := os.NewFile(uintptr(fd), p)
	defer f.Close()
	if _, err := f.WriteString(content); err != nil {
		t.Fatal(err)
	}
}

func TestMergedViewAndVirtualEntries(t *testing.T) {
	u, _ := newTestUnion(t, base)
	root, errno := u.ReadDir("")
	if errno != 0 {
		t.Fatal(errno)
	}
	if got, want := names(root), []string{".livemain", "node_modules", "package.json", "src", "tests"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("root = %v want %v", got, want)
	}
	if st, _ := u.Stat("node_modules"); st.Type != TypeSymlink || st.Layer != LayerVirtual {
		t.Fatalf("node_modules = %+v", st)
	}
	if target, _ := u.Readlink(context.Background(), "node_modules"); target != "/deps/node_modules" {
		t.Fatalf("node_modules -> %q", target)
	}
	if _, errno := u.Stat(".livemain/inbox"); errno != 0 {
		t.Fatalf(".livemain/inbox: %v", errno)
	}
	if _, errno := u.OpenWrite(context.Background(), ".livemain/inbox", syscall.O_WRONLY); errno == 0 {
		t.Fatal("inbox writable")
	}
	if got := readMerged(t, u, "src/core/value.ts"); got != base["src/core/value.ts"] {
		t.Fatalf("value.ts = %q", got)
	}
}

func TestReadSetLoggingAndIgnoreRules(t *testing.T) {
	u, _ := newTestUnion(t, base)
	ctx := context.Background()
	u.Lookup("src")                  // directory: not logged
	u.Lookup("src/core/registry.ts") // regular file lookup: lookup set only
	u.OpenRead(ctx, "src/core/value.ts")
	u.OpenRead(ctx, ".livemain/inbox") // never logged
	u.Lookup("node_modules")           // virtual symlink: never logged
	u.Lookup("src/missing.ts")         // failed lookup: not logged
	u.ReadDir("src/core")
	if got, want := u.ReadSet(), []string{"src/core/value.ts"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("read set = %v want %v", got, want)
	}
	if got, want := u.LookupSet(), []string{"src/core/registry.ts"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("lookup set = %v want %v", got, want)
	}
	u.Lookup("src/core/value.ts") // opened files are not repeated in the lookup set
	if got := u.LookupSet(); len(got) != 1 {
		t.Fatalf("lookup set = %v", got)
	}
	if got := u.ReaddirSet(); !reflect.DeepEqual(got, []string{"src/core"}) {
		t.Fatalf("readdir set = %v", got)
	}
	for _, p := range []string{"node_modules/vitest/index.js", ".git/HEAD", ".livemain/inbox", "a/node_modules/x.js"} {
		if !Ignored(p) {
			t.Errorf("Ignored(%q) = false", p)
		}
	}
	if Ignored("src/node_modules_helper.ts") {
		t.Error("over-eager ignore")
	}
}

func TestCopyUpOnWriteAndOverlayChanges(t *testing.T) {
	u, _ := newTestUnion(t, base)
	writeVia(t, u, "src/core/registry.ts", "export const registry = {\n  SUM: 1,\n};\n")
	if _, errno := u.Mkdir("src/functions", 0o755); errno != 0 {
		t.Fatal(errno)
	}
	writeVia(t, u, "src/functions/SUM.ts", "export default 1;\n")
	// lower untouched, upper holds the copy
	if _, err := os.Stat(filepath.Join(u.UpperDir(), "src/core/value.ts")); !os.IsNotExist(err) {
		t.Fatal("unmodified file was copied up")
	}
	if got := readMerged(t, u, "src/core/registry.ts"); got != "export const registry = {\n  SUM: 1,\n};\n" {
		t.Fatalf("registry = %q", got)
	}
	// A file copied up and written back unchanged is in the write set but not a change.
	writeVia(t, u, "package.json", "{}\n")
	if got, want := u.WriteSet(), []string{"package.json", "src/core/registry.ts", "src/functions/SUM.ts"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("write set = %v want %v", got, want)
	}
	changes, err := u.Changes()
	if err != nil {
		t.Fatal(err)
	}
	if len(changes) != 2 || changes[0].Path != "src/core/registry.ts" || changes[1].Path != "src/functions/SUM.ts" {
		t.Fatalf("changes = %+v", changes)
	}
	// O_RDWR opens count as reads; write-only opens do not.
	u.ResetReadSet()
	writeVia(t, u, "src/eval/evaluate.ts", "x\n")
	fd, errno := u.OpenWrite(context.Background(), "tests/a.test.ts", syscall.O_RDWR)
	if errno != 0 {
		t.Fatal(errno)
	}
	syscall.Close(fd)
	if rs := u.ReadSet(); !reflect.DeepEqual(rs, []string{"tests/a.test.ts"}) {
		t.Fatalf("read set = %v", rs)
	}
}

func TestWhiteoutsForUnlinkRmdirAndRecreate(t *testing.T) {
	u, _ := newTestUnion(t, base)
	if errno := u.Unlink("src/eval/evaluate.ts"); errno != 0 {
		t.Fatal(errno)
	}
	if _, errno := u.Stat("src/eval/evaluate.ts"); errno != syscall.ENOENT {
		t.Fatalf("deleted file still visible: %v", errno)
	}
	es, _ := u.ReadDir("src/eval")
	if len(es) != 0 {
		t.Fatalf("src/eval = %v", names(es))
	}
	if errno := u.Rmdir("src/eval"); errno != 0 {
		t.Fatal(errno)
	}
	if errno := u.Rmdir("src/core"); errno != syscall.ENOTEMPTY {
		t.Fatalf("rmdir non-empty = %v", errno)
	}
	// Recreating a deleted lower dir is opaque: old lower children stay hidden.
	if _, errno := u.Mkdir("src/eval", 0o755); errno != 0 {
		t.Fatal(errno)
	}
	es, _ = u.ReadDir("src/eval")
	if len(es) != 0 {
		t.Fatalf("recreated dir shows lower children: %v", names(es))
	}
	changes, _ := u.Changes()
	if len(changes) != 1 || changes[0].Path != "src/eval/evaluate.ts" || changes[0].Content != nil {
		t.Fatalf("changes = %+v", changes)
	}
	if ws := u.WriteSet(); !reflect.DeepEqual(ws, []string{"src/eval/evaluate.ts"}) {
		t.Fatalf("write set = %v", ws)
	}
	// Recreate the file: whiteout no longer matters for it, content wins.
	writeVia(t, u, "src/eval/evaluate.ts", "new\n")
	if got := readMerged(t, u, "src/eval/evaluate.ts"); got != "new\n" {
		t.Fatalf("recreated = %q", got)
	}
	changes, _ = u.Changes()
	if len(changes) != 1 || changes[0].Content == nil || *changes[0].Content != "new\n" {
		t.Fatalf("changes = %+v", changes)
	}
	// Deleting a recreated file again restores the deletion.
	if errno := u.Unlink("src/eval/evaluate.ts"); errno != 0 {
		t.Fatal(errno)
	}
	if _, errno := u.Stat("src/eval/evaluate.ts"); errno != syscall.ENOENT {
		t.Fatal("file visible after second delete")
	}
	if errno := u.Unlink("node_modules"); errno != syscall.EPERM {
		t.Fatalf("unlink node_modules = %v", errno)
	}
}

func TestRenameIsCopyUpPlusWhiteout(t *testing.T) {
	u, _ := newTestUnion(t, base)
	ctx := context.Background()
	if errno := u.Rename(ctx, "src/core/value.ts", "src/core/val.ts", 0); errno != 0 {
		t.Fatal(errno)
	}
	if _, errno := u.Stat("src/core/value.ts"); errno != syscall.ENOENT {
		t.Fatal("rename source still visible")
	}
	if got := readMerged(t, u, "src/core/val.ts"); got != base["src/core/value.ts"] {
		t.Fatalf("renamed content = %q", got)
	}
	// Directory with mixed upper/lower content.
	writeVia(t, u, "src/core/extra.ts", "extra\n")
	if errno := u.Rename(ctx, "src/core", "src/kernel", 0); errno != 0 {
		t.Fatal(errno)
	}
	es, errno := u.ReadDir("src/kernel")
	if errno != 0 {
		t.Fatal(errno)
	}
	if got, want := names(es), []string{"extra.ts", "registry.ts", "val.ts"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("src/kernel = %v want %v", got, want)
	}
	if _, errno := u.Stat("src/core"); errno != syscall.ENOENT {
		t.Fatal("old dir still visible")
	}
	changes, _ := u.Changes()
	got := map[string]bool{}
	for _, c := range changes {
		got[fmt.Sprintf("%s:%v", c.Path, c.Content != nil)] = true
	}
	for _, want := range []string{"src/core/value.ts:false", "src/core/registry.ts:false", "src/kernel/val.ts:true", "src/kernel/registry.ts:true", "src/kernel/extra.ts:true"} {
		if !got[want] {
			t.Errorf("missing change %s in %v", want, got)
		}
	}
	// Overwriting rename and NOREPLACE.
	writeVia(t, u, "x.ts", "x\n")
	if errno := u.Rename(ctx, "x.ts", "package.json", renameNoRepl); errno != syscall.EEXIST {
		t.Fatalf("noreplace = %v", errno)
	}
	if errno := u.Rename(ctx, "x.ts", "package.json", 0); errno != 0 {
		t.Fatal(errno)
	}
	if got := readMerged(t, u, "package.json"); got != "x\n" {
		t.Fatalf("package.json = %q", got)
	}
}

func TestTruncateAndChmodCopyUp(t *testing.T) {
	u, _ := newTestUnion(t, base)
	ctx := context.Background()
	if errno := u.Truncate(ctx, "tests/a.test.ts", 2); errno != 0 {
		t.Fatal(errno)
	}
	if got := readMerged(t, u, "tests/a.test.ts"); got != "te" {
		t.Fatalf("truncated = %q", got)
	}
	if errno := u.Chmod(ctx, "package.json", 0o755); errno != 0 {
		t.Fatal(errno)
	}
	if st, _ := u.Stat("package.json"); st.Layer != LayerUpper || st.Perm != 0o755 {
		t.Fatalf("chmod = %+v", st)
	}
}

func TestAdvanceCarriesForwardUnchangedReads(t *testing.T) {
	u, blobs := newTestUnion(t, base)
	ctx := context.Background()
	u.OpenRead(ctx, "src/core/value.ts")
	u.OpenRead(ctx, "src/eval/evaluate.ts")
	u.ReadDir("src/core")
	next := map[string]string{}
	for k, v := range base {
		next[k] = v
	}
	next["src/core/value.ts"] = "export type Value = number | string;\n"
	gen := u.Advance(lowerOf(blobs, "c2", next), []string{"src/core/value.ts"})
	if gen != 2 || u.Generation() != 2 {
		t.Fatalf("generation = %d", gen)
	}
	if got := u.ReadSet(); !reflect.DeepEqual(got, []string{"src/eval/evaluate.ts"}) {
		t.Fatalf("read set after advance = %v", got)
	}
	if got := u.ReaddirSet(); len(got) != 0 {
		t.Fatalf("readdir set after advance = %v", got)
	}
	if got := readMerged(t, u, "src/core/value.ts"); got != next["src/core/value.ts"] {
		t.Fatalf("value.ts after advance = %q", got)
	}
	st1, _ := u.Stat("src/eval/evaluate.ts")
	st2, _ := u.Stat("src/core/value.ts")
	if !st2.Mtime.After(st1.Mtime) {
		t.Fatal("delta path mtime not bumped")
	}
}

func TestResetToLowerUnderWhitedOutAncestor(t *testing.T) {
	u, _ := newTestUnion(t, base)
	// Delete dir, recreate it with a file of the same name.
	for _, p := range []string{"src/eval/evaluate.ts"} {
		u.Unlink(p)
	}
	u.Rmdir("src/eval")
	u.Mkdir("src/eval", 0o755)
	writeVia(t, u, "src/eval/evaluate.ts", "mine\n")
	if err := u.ResetToLower("src/eval/evaluate.ts", []byte("theirs\n"), true); err != nil {
		t.Fatal(err)
	}
	if got := readMerged(t, u, "src/eval/evaluate.ts"); got != "theirs\n" {
		t.Fatalf("got %q", got)
	}
	// Plain case: upper copy removed, lower shows through.
	writeVia(t, u, "package.json", "{ \"a\": 1 }\n")
	if err := u.ResetToLower("package.json", nil, true); err != nil {
		t.Fatal(err)
	}
	if st, _ := u.Stat("package.json"); st.Layer != LayerLower {
		t.Fatalf("package.json layer = %v", st.Layer)
	}
}
