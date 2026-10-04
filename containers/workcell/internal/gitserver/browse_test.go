package gitserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"livemain/workcell/internal/gitstore"
)

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

// commitFiles writes files into a scratch clone of the bare repo and pushes one commit to main.
func commitFiles(t *testing.T, bare string, files map[string]string, msg string) string {
	t.Helper()
	ctx := context.Background()
	work := t.TempDir()
	_, err := gitstore.Git(ctx, "", "clone", "-q", bare, work)
	must(t, err)
	_, _ = gitstore.Git(ctx, work, "checkout", "-q", "-B", "main")
	for p, c := range files {
		must(t, os.MkdirAll(filepath.Dir(filepath.Join(work, p)), 0o755))
		must(t, os.WriteFile(filepath.Join(work, p), []byte(c), 0o644))
	}
	for _, args := range [][]string{{"add", "-A"}, {"-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", msg}, {"push", "-q", "origin", "main"}} {
		_, err := gitstore.Git(ctx, work, args...)
		must(t, err)
	}
	sha, err := gitstore.Git(ctx, work, "rev-parse", "HEAD")
	must(t, err)
	return sha
}

func getJSON(t *testing.T, srv *httptest.Server, path string, into any) int {
	t.Helper()
	res, err := http.Get(srv.URL + path)
	must(t, err)
	defer res.Body.Close()
	if res.StatusCode == http.StatusOK {
		must(t, json.NewDecoder(res.Body).Decode(into))
	}
	return res.StatusCode
}

func TestBrowseAndImport(t *testing.T) {
	ctx := context.Background()
	s, err := New(t.TempDir(), "http://unused")
	must(t, err)
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()
	must(t, s.Create(ctx, "demo"))
	first := commitFiles(t, s.repoDir("demo"), map[string]string{"README.md": "# demo\n", "src/a.ts": "export const a = 1;\n"}, "seed")
	second := commitFiles(t, s.repoDir("demo"), map[string]string{"src/a.ts": "export const a = 2;\n", "src/b.ts": "export const b = 1;\n"}, "change a, add b")

	var tree struct{ Entries []treeEntry }
	if code := getJSON(t, srv, "/repos/demo/tree?ref=main", &tree); code != 200 {
		t.Fatalf("tree: %d", code)
	}
	got := map[string]string{}
	for _, e := range tree.Entries {
		got[e.Path] = e.Type
	}
	if got["src"] != "dir" || got["src/b.ts"] != "file" || got["README.md"] != "file" {
		t.Fatalf("tree entries: %v", got)
	}

	var log struct{ Commits []commit }
	getJSON(t, srv, "/repos/demo/log?ref=main", &log)
	if len(log.Commits) != 2 || log.Commits[0].Sha != second || log.Commits[0].Subject != "change a, add b" || log.Commits[1].Sha != first {
		t.Fatalf("log: %+v", log.Commits)
	}
	getJSON(t, srv, "/repos/demo/log?ref=main&path=src/b.ts", &log)
	if len(log.Commits) != 1 {
		t.Fatalf("path log: %+v", log.Commits)
	}

	var diff struct{ Patch string }
	getJSON(t, srv, "/repos/demo/diff?to="+second, &diff)
	if !strings.Contains(diff.Patch, "-export const a = 1;") || !strings.Contains(diff.Patch, "+export const b = 1;") {
		t.Fatalf("diff: %s", diff.Patch)
	}
	getJSON(t, srv, "/repos/demo/diff?to="+first, &diff) // root commit diffs against the empty tree
	if !strings.Contains(diff.Patch, "+# demo") {
		t.Fatalf("root diff: %s", diff.Patch)
	}
	if code := getJSON(t, srv, "/repos/demo/diff?to=main;rm", &diff); code != 400 {
		t.Fatalf("bad ref accepted: %d", code)
	}

	// First commit of a new, empty repo.
	must(t, s.Create(ctx, "fresh"))
	res0, err := http.Post(srv.URL+"/repos/fresh/init", "application/json", strings.NewReader(`{"files":{"README.md":"# fresh\n","docs/a.md":"a"},"message":"Initial commit"}`))
	must(t, err)
	res0.Body.Close()
	if code := getJSON(t, srv, "/repos/fresh/tree?ref=main", &tree); code != 200 || len(tree.Entries) != 3 {
		t.Fatalf("fresh tree: %d %+v", code, tree.Entries)
	}

	// Import over git smart HTTP from this same server into an empty repo.
	must(t, s.Create(ctx, "copy"))
	res, err := http.Post(srv.URL+"/repos/copy/import", "application/json", strings.NewReader(`{"url":"`+srv.URL+`/demo.git"}`))
	must(t, err)
	var imp struct{ Sha string }
	must(t, json.NewDecoder(res.Body).Decode(&imp))
	res.Body.Close()
	if imp.Sha != second {
		t.Fatalf("import sha %q want %q", imp.Sha, second)
	}
	res, err = http.Post(srv.URL+"/repos/copy/import", "application/json", strings.NewReader(`{"url":"`+srv.URL+`/demo.git"}`))
	must(t, err)
	res.Body.Close()
	if res.StatusCode != http.StatusConflict {
		t.Fatalf("second import into a non-empty repo: %d", res.StatusCode)
	}
}
