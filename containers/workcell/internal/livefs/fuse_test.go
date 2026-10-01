package livefs_test

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"sort"
	"sync"
	"syscall"
	"testing"

	"livemain/workcell/internal/gitstore"
	"livemain/workcell/internal/livefs"
	"livemain/workcell/internal/testutil"
)

// These tests need a real FUSE device (Linux, /dev/fuse, CAP_SYS_ADMIN or
// fusermount3). They run in Docker: `docker build --target test` (see README).

type fixture struct {
	repo   *testutil.Repo
	mirror *gitstore.Mirror
	mount  *livefs.Mount
	dir    string
}

func requireFuse(t *testing.T) {
	t.Helper()
	if runtime.GOOS != "linux" {
		t.Skip("FUSE tests run on Linux only")
	}
	if _, err := os.Stat("/dev/fuse"); err != nil {
		t.Skip("/dev/fuse not available")
	}
}

func mountFixture(t *testing.T, files map[string]*string) (*fixture, string) {
	t.Helper()
	requireFuse(t)
	ctx := context.Background()
	repo := testutil.NewRepo(t)
	sha := repo.Commit("v1", files)
	mirror, err := gitstore.OpenMirror(ctx, filepath.Join(t.TempDir(), "mirror.git"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(mirror.Close)
	if err := mirror.Fetch(ctx, repo.Remote, sha); err != nil {
		t.Fatal(err)
	}
	idx, err := mirror.Index(ctx, sha)
	if err != nil {
		t.Fatal(err)
	}
	u, err := livefs.NewUnion(livefs.Config{
		UpperDir:   filepath.Join(t.TempDir(), "upper"),
		DepsTarget: "/deps/node_modules",
		Inbox:      func() []byte { return []byte("inbox!\n") },
		Blobs:      mirror,
	}, idx)
	if err != nil {
		t.Fatal(err)
	}
	dir := filepath.Join(t.TempDir(), "mnt")
	m, err := livefs.MountUnion(dir, u, livefs.MountOptions{})
	if err != nil {
		t.Skipf("cannot mount FUSE here: %v", err)
	}
	t.Cleanup(func() {
		if err := m.Unmount(); err != nil {
			t.Errorf("unmount: %v", err)
		}
	})
	return &fixture{repo: repo, mirror: mirror, mount: m, dir: dir}, sha
}

// advance commits files on the remote and swaps the mount to the new commit.
func (f *fixture) advance(t *testing.T, from string, files map[string]*string) string {
	t.Helper()
	ctx := context.Background()
	sha := f.repo.Commit("next", files)
	if err := f.mirror.Fetch(ctx, f.repo.Remote, sha); err != nil {
		t.Fatal(err)
	}
	idx, err := f.mirror.Index(ctx, sha)
	if err != nil {
		t.Fatal(err)
	}
	delta, err := f.mirror.DiffNames(ctx, from, sha)
	if err != nil {
		t.Fatal(err)
	}
	f.mount.Advance(idx, delta)
	return sha
}

func (f *fixture) path(p string) string { return filepath.Join(f.dir, p) }

func readFile(t *testing.T, p string) string {
	t.Helper()
	b, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

var v1Files = testutil.Files(
	"package.json", "{}\n",
	"src/core/value.ts", "export type Value = number;\n",
	"src/core/registry.ts", "export const registry = {\n};\n",
	"src/functions/SUM.ts", "export default 1;\n",
	"tests/SUM.test.ts", "test\n",
)

func TestFuseReadsLogReadSet(t *testing.T) {
	f, _ := mountFixture(t, v1Files)
	if got := readFile(t, f.path("src/core/value.ts")); got != "export type Value = number;\n" {
		t.Fatalf("read = %q", got)
	}
	if _, err := os.Stat(f.path("src/core/registry.ts")); err != nil {
		t.Fatal(err)
	}
	if target, err := os.Readlink(f.path("node_modules")); err != nil || target != "/deps/node_modules" {
		t.Fatalf("node_modules -> %q %v", target, err)
	}
	if got := readFile(t, f.path(".livemain/inbox")); got != "inbox!\n" {
		t.Fatalf("inbox = %q", got)
	}
	des, err := os.ReadDir(f.path(""))
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, d := range des {
		names = append(names, d.Name())
	}
	if want := []string{".livemain", "node_modules", "package.json", "src", "tests"}; !reflect.DeepEqual(names, want) {
		t.Fatalf("root = %v", names)
	}
	got := f.mount.U.ReadSet()
	want := []string{"src/core/value.ts"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("read set = %v want %v", got, want)
	}
	if got := f.mount.U.LookupSet(); !reflect.DeepEqual(got, []string{"src/core/registry.ts"}) {
		t.Fatalf("lookup set = %v", got)
	}
	// Listing a directory must not log its files (no readdirplus).
	if _, err := os.ReadDir(f.path("src/functions")); err != nil {
		t.Fatal(err)
	}
	if got := f.mount.U.ReadSet(); !reflect.DeepEqual(got, want) {
		t.Fatalf("readdir polluted the read set: %v", got)
	}
	if got := f.mount.U.LookupSet(); len(got) != 1 {
		t.Fatalf("readdir polluted the lookup set: %v", got)
	}
}

func TestFuseWritesLandInUpper(t *testing.T) {
	f, _ := mountFixture(t, v1Files)
	if err := os.WriteFile(f.path("src/core/registry.ts"), []byte("export const registry = {\n  SUM,\n};\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(f.path("src/functions/math"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(f.path("src/functions/math/MAX.ts"), []byte("max\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	upper := f.mount.U.UpperDir()
	if got := readFile(t, filepath.Join(upper, "src/core/registry.ts")); got != "export const registry = {\n  SUM,\n};\n" {
		t.Fatalf("upper registry = %q", got)
	}
	if _, err := os.Stat(filepath.Join(upper, "src/core/value.ts")); !os.IsNotExist(err) {
		t.Fatal("untouched file copied up")
	}
	// Append through the mount.
	af, err := os.OpenFile(f.path("tests/SUM.test.ts"), os.O_APPEND|os.O_WRONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	af.WriteString("more\n")
	af.Close()
	if got := readFile(t, f.path("tests/SUM.test.ts")); got != "test\nmore\n" {
		t.Fatalf("appended = %q", got)
	}
	// Delete and rename.
	if err := os.Remove(f.path("src/functions/SUM.ts")); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(f.path("src/functions/SUM.ts")); !os.IsNotExist(err) {
		t.Fatalf("deleted file visible: %v", err)
	}
	if err := os.Rename(f.path("package.json"), f.path("package2.json")); err != nil {
		t.Fatal(err)
	}
	if got := readFile(t, f.path("package2.json")); got != "{}\n" {
		t.Fatalf("renamed = %q", got)
	}
	changes, err := f.mount.U.Changes()
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, c := range changes {
		got = append(got, fmt.Sprintf("%s:%v", c.Path, c.Content != nil))
	}
	want := []string{"package.json:false", "package2.json:true", "src/core/registry.ts:true", "src/functions/SUM.ts:false", "src/functions/math/MAX.ts:true", "tests/SUM.test.ts:true"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("changes = %v want %v", got, want)
	}
	if err := os.WriteFile(f.path("node_modules/x"), []byte("x"), 0o644); err == nil {
		t.Fatal("wrote through node_modules")
	}
}

func TestFuseSwapKeepsOpenHandlesAndInvalidates(t *testing.T) {
	f, v1 := mountFixture(t, v1Files)
	valuePath := f.path("src/core/value.ts")
	// Warm kernel caches: content, attrs, a negative entry, a dentry to delete.
	old := readFile(t, valuePath)
	if _, err := os.Stat(f.path("src/core/new.ts")); !os.IsNotExist(err) {
		t.Fatal("new.ts exists early")
	}
	if _, err := os.Stat(f.path("tests/SUM.test.ts")); err != nil {
		t.Fatal(err)
	}
	h, err := os.Open(valuePath)
	if err != nil {
		t.Fatal(err)
	}
	defer h.Close()

	newValue := "export type Value = number | string | boolean;\n"
	f.advance(t, v1, map[string]*string{
		"src/core/value.ts": testutil.S(newValue),
		"src/core/new.ts":   testutil.S("new\n"),
		"tests/SUM.test.ts": nil,
	})
	if g := f.mount.U.Generation(); g != 2 {
		t.Fatalf("generation = %d", g)
	}
	// New opens and stats see the new generation immediately (well within the 1s TTL).
	if got := readFile(t, valuePath); got != newValue {
		t.Fatalf("after swap read %q", got)
	}
	if fi, err := os.Stat(valuePath); err != nil || fi.Size() != int64(len(newValue)) {
		t.Fatalf("after swap stat size %v %v", fi, err)
	}
	if got := readFile(t, f.path("src/core/new.ts")); got != "new\n" {
		t.Fatalf("new file %q", got)
	}
	if _, err := os.Stat(f.path("tests/SUM.test.ts")); !os.IsNotExist(err) {
		t.Fatalf("deleted file still visible: %v", err)
	}
	// The handle opened before the swap keeps reading the old blob.
	b, err := io.ReadAll(h)
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != old {
		t.Fatalf("old handle read %q want %q", b, old)
	}
}

func TestFuseConcurrentWriters(t *testing.T) {
	f, _ := mountFixture(t, v1Files)
	const n = 16
	var wg sync.WaitGroup
	errs := make(chan error, n*4)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			dir := f.path(fmt.Sprintf("gen/w%d", i))
			if err := os.MkdirAll(dir, 0o755); err != nil {
				errs <- err
				return
			}
			for j := 0; j < 20; j++ {
				p := filepath.Join(dir, fmt.Sprintf("f%d.ts", j))
				want := fmt.Sprintf("writer %d file %d\n", i, j)
				if err := os.WriteFile(p, []byte(want), 0o644); err != nil {
					errs <- err
					return
				}
				got, err := os.ReadFile(p)
				if err != nil || string(got) != want {
					errs <- fmt.Errorf("%s: got %q err %v", p, got, err)
					return
				}
			}
			// Everyone also rewrites a shared lower file (copy-up race).
			if err := os.WriteFile(f.path("src/core/registry.ts"), []byte(fmt.Sprintf("w%d\n", i)), 0o644); err != nil {
				errs <- err
			}
		}(i)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Error(err)
	}
	ws := f.mount.U.WriteSet()
	if len(ws) != n*20+1 {
		t.Fatalf("write set has %d entries", len(ws))
	}
	if !sort.StringsAreSorted(ws) {
		t.Fatal("write set not sorted")
	}
	var perr *os.PathError
	if _, err := os.Stat(f.path("gen/w0/f19.ts")); errors.As(err, &perr) {
		t.Fatal(err)
	}
	if err := syscall.Access(f.path("gen/w3/f3.ts"), 4); err != nil {
		t.Fatal(err)
	}
}
