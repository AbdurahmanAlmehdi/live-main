package integrator

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"livemain/workcell/internal/apierr"
	"livemain/workcell/internal/gitstore"
	"livemain/workcell/internal/merge"
	"livemain/workcell/internal/sigdiff"
	"livemain/workcell/internal/testutil"
)

const registryV1 = "export const registry = {\n  SUM: 1,\n  // marker\n};\n"

func addLine(s, line string) string {
	return s[:len(s)-len("  // marker\n};\n")] + line + "\n  // marker\n};\n"
}

func newIntegrator(t *testing.T) (*Integrator, *testutil.Repo) {
	t.Helper()
	ctx := context.Background()
	mirror, err := gitstore.OpenMirror(ctx, filepath.Join(t.TempDir(), "mirror.git"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(mirror.Close)
	stub := sigdiff.New(filepath.Join(testutil.TestdataDir(), "sigdiff-stub.cjs"))
	t.Cleanup(stub.Close)
	in := New(Config{DataDir: t.TempDir(), Mirror: mirror, Merger: &merge.Merger{}, Sigdiff: stub})
	return in, testutil.NewRepo(t)
}

func code(err error) string {
	if e, ok := apierr.As(err); ok {
		return e.Code
	}
	if err != nil {
		return err.Error()
	}
	return ""
}

func TestIntegratePaths(t *testing.T) {
	testutil.RequireNode(t)
	ctx := context.Background()
	in, repo := newIntegrator(t)
	v1 := repo.Commit("v1", testutil.Files("src/registry.ts", registryV1, "src/value.ts", "export const v = 1;\n", "src/old.ts", "old\n"))

	// Plain promotion at head: add a file, delete one.
	res, err := in.Integrate(ctx, IntegrateRequest{
		Remote: repo.Remote, ExpectedHeadSha: v1, PinSha: v1, Message: "promote A", Author: "agent-a <a@livemain>",
		Changes: []Change{{Path: "src/MAX.ts", Content: testutil.S("export default 1;\n")}, {Path: "src/old.ts"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	v2 := res.Sha
	if res.Parent != v1 || len(res.ChangedPaths) != 2 || res.Classes["src/MAX.ts"] != sigdiff.ClassAdditive || res.Impact != nil {
		t.Fatalf("res = %+v", res)
	}
	if head, _ := in.cfg.Mirror.RemoteRef(ctx, repo.Remote, mainRef); head != v2 {
		t.Fatalf("remote head %s want %s", head, v2)
	}
	author := testutil.Git(t, in.cfg.Mirror.Dir, "log", "-1", "--format=%an <%ae>|%s", v2)
	if author != "agent-a <a@livemain>|promote A" {
		t.Fatalf("commit meta = %q", author)
	}

	// Stale expected head.
	_, err = in.Integrate(ctx, IntegrateRequest{Remote: repo.Remote, ExpectedHeadSha: v1, PinSha: v1,
		Changes: []Change{{Path: "x.ts", Content: testutil.S("x\n")}}})
	if code(err) != "head-moved" {
		t.Fatalf("stale head: %v", err)
	}

	// Main moved the registry since the overlay's pin (v1): needs checkpoint...
	v3 := repo.Commit("upstream registry", map[string]*string{"src/registry.ts": testutil.S(addLine(registryV1, "  MIN: 1,"))})
	req := IntegrateRequest{Remote: repo.Remote, ExpectedHeadSha: v3, PinSha: v1,
		Changes: []Change{{Path: "src/registry.ts", Content: testutil.S(addLine(registryV1, "  AVG: 1,"))}, {Path: "src/AVG.ts", Content: testutil.S("avg\n")}}}
	_, err = in.Integrate(ctx, req)
	if code(err) != "needs-checkpoint" {
		t.Fatalf("expected needs-checkpoint, got %v", err)
	}
	if e, _ := apierr.As(err); len(e.Extra["paths"].([]string)) != 1 {
		t.Fatalf("paths = %v", e.Extra)
	}
	// ...unless the coordinator allows auto-merging it (both sides additive).
	req.AutoMerge = []string{"src/registry.ts"}
	res, err = in.Integrate(ctx, req)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Merged) != 1 || res.Merged[0].Method != merge.MethodUnion {
		t.Fatalf("merged = %+v", res.Merged)
	}
	got := testutil.Git(t, in.cfg.Mirror.Dir, "show", res.Sha+":src/registry.ts")
	want := addLine(addLine(registryV1, "  AVG: 1,"), "  MIN: 1,")
	if got+"\n" != want {
		t.Fatalf("merged registry:\n%s\nwant:\n%s", got, want)
	}
	v4 := res.Sha

	// Auto-merge refused when a side is not additive.
	v5 := repo.Commit("body change", map[string]*string{"src/value.ts": testutil.S("export const v = 2;\n")})
	_, err = in.Integrate(ctx, IntegrateRequest{Remote: repo.Remote, ExpectedHeadSha: v5, PinSha: v4, AutoMerge: []string{"src/value.ts"},
		Changes: []Change{{Path: "src/value.ts", Content: testutil.S("export const v = 1;\nexport const w = 1;\n")}}})
	if code(err) != "needs-checkpoint" {
		t.Fatalf("non-additive auto-merge: %v", err)
	}

	// No-op promotion leaves main alone.
	res, err = in.Integrate(ctx, IntegrateRequest{Remote: repo.Remote, ExpectedHeadSha: v5, PinSha: v5,
		Changes: []Change{{Path: "src/value.ts", Content: testutil.S("export const v = 2;\n")}}})
	if err != nil || res.Sha != v5 || len(res.ChangedPaths) != 0 {
		t.Fatalf("noop: %+v %v", res, err)
	}
}

func TestSeed(t *testing.T) {
	ctx := context.Background()
	in, repo := newIntegrator(t)
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "src"), 0o755)
	os.MkdirAll(filepath.Join(dir, "node_modules", "x"), 0o755)
	os.WriteFile(filepath.Join(dir, "src", "a.ts"), []byte("a\n"), 0o644)
	os.WriteFile(filepath.Join(dir, "node_modules", "x", "i.js"), []byte("x\n"), 0o644)
	sha, err := in.Seed(ctx, SeedRequest{Remote: repo.Remote, Dir: dir, Message: "seed"})
	if err != nil {
		t.Fatal(err)
	}
	files := testutil.Git(t, in.cfg.Mirror.Dir, "ls-tree", "-r", "--name-only", sha)
	if files != "src/a.ts" {
		t.Fatalf("seeded files = %q", files)
	}
	if _, err := in.Seed(ctx, SeedRequest{Remote: repo.Remote, Dir: dir}); code(err) != "already-seeded" {
		t.Fatalf("second seed: %v", err)
	}
}

func TestSeedFiles(t *testing.T) {
	ctx := context.Background()
	in, repo := newIntegrator(t)
	for _, bad := range []SeedRequest{
		{Remote: repo.Remote},
		{Remote: repo.Remote, Dir: t.TempDir(), Files: map[string]string{"a": "a"}},
		{Remote: repo.Remote, Files: map[string]string{"../x": "x"}},
		{Remote: repo.Remote, Files: map[string]string{".git/config": "x"}},
		{Remote: repo.Remote, URL: "file:///etc"},
	} {
		if _, err := in.Seed(ctx, bad); code(err) != "bad-request" {
			t.Fatalf("seed %+v: %v", bad, err)
		}
	}
	sha, err := in.Seed(ctx, SeedRequest{Remote: repo.Remote, Files: map[string]string{"README.md": "# x\n", "docs/a.md": "a"}, Message: "Initial commit"})
	if err != nil {
		t.Fatal(err)
	}
	if files := testutil.Git(t, in.cfg.Mirror.Dir, "ls-tree", "-r", "--name-only", sha); files != "README.md\ndocs/a.md" {
		t.Fatalf("seeded files = %q", files)
	}
}

func TestIntegratePrefersPushedCommit(t *testing.T) {
	ctx := context.Background()
	in, repo := newIntegrator(t)
	v1 := repo.Commit("v1", testutil.Files("README.md", "hi\n"))
	// A person's commit on v1, pushed to a side ref (as the git gateway does).
	os.WriteFile(filepath.Join(repo.Work, "README.md"), []byte("hi there\n"), 0o644)
	testutil.Git(t, repo.Work, "commit", "-qam", "person edit")
	pushed := testutil.Git(t, repo.Work, "rev-parse", "HEAD")
	testutil.Git(t, repo.Work, "push", "-q", "origin", "HEAD:refs/heads/push/p1")

	// Different content: the built commit lands, not the pushed one.
	res, err := in.Integrate(ctx, IntegrateRequest{Remote: repo.Remote, ExpectedHeadSha: v1, PinSha: v1, Prefer: pushed,
		Changes: []Change{{Path: "README.md", Content: testutil.S("something else\n")}}})
	if err != nil || res.Sha == pushed {
		t.Fatalf("non-equivalent prefer: %+v %v", res, err)
	}
	// Same tree on the same parent: the pushed commit itself lands.
	head := res.Sha
	testutil.Git(t, repo.Work, "fetch", "-q", "origin")
	testutil.Git(t, repo.Work, "reset", "-q", "--hard", "origin/main")
	os.WriteFile(filepath.Join(repo.Work, "README.md"), []byte("final\n"), 0o644)
	testutil.Git(t, repo.Work, "commit", "-qam", "person edit 2")
	pushed = testutil.Git(t, repo.Work, "rev-parse", "HEAD")
	testutil.Git(t, repo.Work, "push", "-q", "origin", "HEAD:refs/heads/push/p2")
	res, err = in.Integrate(ctx, IntegrateRequest{Remote: repo.Remote, ExpectedHeadSha: head, PinSha: head, Prefer: pushed,
		Changes: []Change{{Path: "README.md", Content: testutil.S("final\n")}}})
	if err != nil || res.Sha != pushed || res.Parent != head {
		t.Fatalf("equivalent prefer: %+v %v (pushed %s)", res, err, pushed)
	}
	if main, _ := in.cfg.Mirror.RemoteRef(ctx, repo.Remote, mainRef); main != pushed {
		t.Fatalf("remote main %s, want the pushed commit %s", main, pushed)
	}
}
