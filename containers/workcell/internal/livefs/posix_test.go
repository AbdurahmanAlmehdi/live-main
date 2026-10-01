package livefs_test

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"

	"livemain/workcell/internal/gitstore"
	"livemain/workcell/internal/testutil"
)

// A pjdfstest-style subset of POSIX semantics the agents' tools and test runners rely on.
func TestFusePosixSubset(t *testing.T) {
	f, _ := mountFixture(t, v1Files)
	p := f.path

	t.Run("exclusive create of an existing lower file fails", func(t *testing.T) {
		_, err := os.OpenFile(p("src/core/value.ts"), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
		if !errors.Is(err, os.ErrExist) {
			t.Fatalf("O_EXCL on lower file: %v", err)
		}
	})
	t.Run("rename over an existing lower file replaces it", func(t *testing.T) {
		if err := os.WriteFile(p("tmp.ts"), []byte("new\n"), 0o644); err != nil {
			t.Fatal(err)
		}
		if err := os.Rename(p("tmp.ts"), p("src/functions/SUM.ts")); err != nil {
			t.Fatal(err)
		}
		if got := readFile(t, p("src/functions/SUM.ts")); got != "new\n" {
			t.Fatalf("renamed content %q", got)
		}
		if _, err := os.Stat(p("tmp.ts")); !errors.Is(err, os.ErrNotExist) {
			t.Fatalf("source still visible: %v", err)
		}
	})
	t.Run("rename a lower directory", func(t *testing.T) {
		if err := os.Rename(p("tests"), p("specs")); err != nil {
			t.Fatal(err)
		}
		if got := readFile(t, p("specs/SUM.test.ts")); got != "test\n" {
			t.Fatalf("moved file content %q", got)
		}
		if _, err := os.Stat(p("tests/SUM.test.ts")); !errors.Is(err, os.ErrNotExist) {
			t.Fatalf("old path still visible: %v", err)
		}
	})
	t.Run("rmdir of a non-empty directory fails", func(t *testing.T) {
		err := syscall.Rmdir(p("src/core"))
		if !errors.Is(err, syscall.ENOTEMPTY) && !errors.Is(err, syscall.EEXIST) {
			t.Fatalf("rmdir non-empty: %v", err)
		}
	})
	t.Run("truncate a lower file copies up and shrinks", func(t *testing.T) {
		if err := os.Truncate(p("package.json"), 1); err != nil {
			t.Fatal(err)
		}
		if got := readFile(t, p("package.json")); got != "{" {
			t.Fatalf("truncated content %q", got)
		}
	})
	t.Run("chmod sticks", func(t *testing.T) {
		if err := os.Chmod(p("src/core/registry.ts"), 0o600); err != nil {
			t.Fatal(err)
		}
		fi, err := os.Stat(p("src/core/registry.ts"))
		if err != nil || fi.Mode().Perm() != 0o600 {
			t.Fatalf("mode %v err %v", fi.Mode(), err)
		}
	})
	t.Run("symlink and readlink", func(t *testing.T) {
		if err := os.Symlink("core/value.ts", p("src/value-link.ts")); err != nil {
			t.Fatal(err)
		}
		target, err := os.Readlink(p("src/value-link.ts"))
		if err != nil || target != "core/value.ts" {
			t.Fatalf("readlink %q %v", target, err)
		}
		if got := readFile(t, p("src/value-link.ts")); got != "export type Value = number;\n" {
			t.Fatalf("through symlink %q", got)
		}
	})
	t.Run("unlink while open keeps the handle readable", func(t *testing.T) {
		if err := os.WriteFile(p("scratch.txt"), []byte("still here\n"), 0o644); err != nil {
			t.Fatal(err)
		}
		fh, err := os.Open(p("scratch.txt"))
		if err != nil {
			t.Fatal(err)
		}
		defer fh.Close()
		if err := os.Remove(p("scratch.txt")); err != nil {
			t.Fatal(err)
		}
		buf := make([]byte, 64)
		n, err := fh.Read(buf)
		if err != nil || string(buf[:n]) != "still here\n" {
			t.Fatalf("read after unlink: %q %v", buf[:n], err)
		}
	})
	t.Run("rename with RENAME_NOREPLACE refuses to clobber", func(t *testing.T) {
		if err := os.WriteFile(p("a.txt"), []byte("a"), 0o644); err != nil {
			t.Fatal(err)
		}
		err := renameat2(p("a.txt"), p("src/core/value.ts"), 1 /* RENAME_NOREPLACE */)
		if !errors.Is(err, syscall.EEXIST) {
			t.Fatalf("noreplace over existing: %v", err)
		}
	})
}

// Readers keep getting a consistent version while main advances underneath them.
//
// Every commit is prepared (committed, fetched, indexed) before the readers start: the
// readers live in the same process as the FUSE server, and forking (git) while this
// process holds fds on its own mount is the classic FUSE self-deadlock. The workcell
// never does that (its file tools go through the union, not the mount).
func TestFuseReadersDuringSwaps(t *testing.T) {
	f, sha := mountFixture(t, v1Files)
	ctx := context.Background()
	type step struct {
		idx   *gitstore.TreeIndex
		delta []string
	}
	var steps []step
	for i := 0; i < 20; i++ {
		next := f.repo.Commit("next", testutil.Files("src/core/value.ts", fmt.Sprintf("export type Value = number | V%d;\n", i)))
		if err := f.mirror.Fetch(ctx, f.repo.Remote, next); err != nil {
			t.Fatal(err)
		}
		idx, err := f.mirror.Index(ctx, next)
		if err != nil {
			t.Fatal(err)
		}
		f.mirror.HoldIndex(next)
		delta, err := f.mirror.DiffNames(ctx, sha, next)
		if err != nil {
			t.Fatal(err)
		}
		steps = append(steps, step{idx, delta})
		sha = next
	}
	stop := make(chan struct{})
	var wg sync.WaitGroup
	errs := make(chan error, 64)
	for r := 0; r < 8; r++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-stop:
					return
				default:
				}
				b, err := os.ReadFile(f.path("src/core/value.ts"))
				if err != nil {
					errs <- err
					return
				}
				if s := string(b); !strings.HasPrefix(s, "export type Value = ") {
					errs <- fmt.Errorf("torn read: %q", s)
					return
				}
			}
		}()
	}
	for _, st := range steps {
		f.mount.Advance(st.idx, st.delta)
		time.Sleep(5 * time.Millisecond)
	}
	close(stop)
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Error(err)
	}
	if got := readFile(t, f.path("src/core/value.ts")); got != "export type Value = number | V19;\n" {
		t.Fatalf("after swaps: %q", got)
	}
}
