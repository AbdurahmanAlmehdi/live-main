package gitstore_test

import (
	"context"
	"path/filepath"
	"reflect"
	"testing"

	"livemain/workcell/internal/gitstore"
	"livemain/workcell/internal/testutil"
)

func openMirror(t *testing.T) *gitstore.Mirror {
	t.Helper()
	m, err := gitstore.OpenMirror(context.Background(), filepath.Join(t.TempDir(), "mirror.git"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(m.Close)
	return m
}

func TestPathIndexFromLsTree(t *testing.T) {
	ctx := context.Background()
	r := testutil.NewRepo(t)
	sha := r.Commit("v1", testutil.Files(
		"README.md", "hi\n",
		"src/core/value.ts", "export const x = 1;\n",
		"src/core/registry.ts", "export const r = {};\n",
		"src/eval/evaluate.ts", "x\n",
	))
	m := openMirror(t)
	if err := m.Fetch(ctx, r.Remote, sha); err != nil {
		t.Fatal(err)
	}
	idx, err := m.Index(ctx, sha)
	if err != nil {
		t.Fatal(err)
	}
	if got := idx.Children(""); !reflect.DeepEqual(got, []string{"README.md", "src"}) {
		t.Fatalf("root children = %v", got)
	}
	if got := idx.Children("src"); !reflect.DeepEqual(got, []string{"core", "eval"}) {
		t.Fatalf("src children = %v", got)
	}
	e, ok := idx.Lookup("src/core/value.ts")
	if !ok || !e.IsRegular() || e.Size != int64(len("export const x = 1;\n")) {
		t.Fatalf("value.ts entry = %+v ok=%v", e, ok)
	}
	if d, ok := idx.Lookup("src/core"); !ok || !d.IsDir() {
		t.Fatalf("src/core = %+v", d)
	}
	if _, ok := idx.Lookup("src/nope.ts"); ok {
		t.Fatal("unexpected entry")
	}
	if got := idx.Files("src/core"); !reflect.DeepEqual(got, []string{"src/core/registry.ts", "src/core/value.ts"}) {
		t.Fatalf("files = %v", got)
	}
	data, err := m.Blob(ctx, e.SHA)
	if err != nil || string(data) != "export const x = 1;\n" {
		t.Fatalf("blob = %q, %v", data, err)
	}
	if gitstore.BlobSHA(data) != e.SHA {
		t.Fatalf("BlobSHA mismatch")
	}
	// cache hit returns the same index
	idx2, _ := m.Index(ctx, sha)
	if idx2 != idx {
		t.Fatal("index not cached")
	}
}

func TestFetchDiffAndCatFileAfterNewPack(t *testing.T) {
	ctx := context.Background()
	r := testutil.NewRepo(t)
	v1 := r.Commit("v1", testutil.Files("a.ts", "a\n", "b.ts", "b\n"))
	m := openMirror(t)
	if err := m.Fetch(ctx, r.Remote, v1); err != nil {
		t.Fatal(err)
	}
	if _, err := m.Blob(ctx, gitstore.BlobSHA([]byte("a\n"))); err != nil {
		t.Fatal(err) // starts the cat-file process
	}
	v2 := r.Commit("v2", map[string]*string{"a.ts": testutil.S("a2\n"), "b.ts": nil, "c/d.ts": testutil.S("d\n")})
	if err := m.Fetch(ctx, r.Remote, v2); err != nil {
		t.Fatal(err)
	}
	// The running cat-file must see objects from the newly fetched pack.
	if b, err := m.Blob(ctx, gitstore.BlobSHA([]byte("a2\n"))); err != nil || string(b) != "a2\n" {
		t.Fatalf("blob after fetch: %q %v", b, err)
	}
	delta, err := m.DiffNames(ctx, v1, v2)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(delta, []string{"a.ts", "b.ts", "c/d.ts"}) {
		t.Fatalf("delta = %v", delta)
	}
	if head, _ := m.RemoteRef(ctx, r.Remote, "refs/heads/main"); head != v2 {
		t.Fatalf("remote head = %s want %s", head, v2)
	}
	if diff := m.UnifiedDiff(ctx, v1, v2, "a.ts", 4096); diff == "" {
		t.Fatal("empty unified diff")
	}
	if _, err := m.Blob(ctx, "0123456789012345678901234567890123456789"); !gitstore.IsNotFound(err) {
		t.Fatalf("missing blob err = %v", err)
	}
}

func TestParseAuthor(t *testing.T) {
	for in, want := range map[string][2]string{
		"agent-17 <agent-17@livemain>": {"agent-17", "agent-17@livemain"},
		"Bob":                          {"Bob", "bob@livemain"},
		"":                             {"livemain", "livemain@livemain"},
	} {
		n, e := gitstore.ParseAuthor(in)
		if n != want[0] || e != want[1] {
			t.Errorf("ParseAuthor(%q) = %q,%q", in, n, e)
		}
	}
}
