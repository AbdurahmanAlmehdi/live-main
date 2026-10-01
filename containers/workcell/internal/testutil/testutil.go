// Package testutil has helpers for tests that need real git repositories.
package testutil

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// Repo is a non-bare working repository plus a bare "remote" it pushes to.
type Repo struct {
	t      *testing.T
	Work   string
	Remote string // bare repo path, usable as a git remote URL
}

// Git runs git in dir and returns trimmed stdout, failing the test on error.
func Git(t *testing.T, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(),
		"GIT_AUTHOR_NAME=test", "GIT_AUTHOR_EMAIL=test@example.com",
		"GIT_COMMITTER_NAME=test", "GIT_COMMITTER_EMAIL=test@example.com",
		"GIT_CONFIG_NOSYSTEM=1", "HOME="+dir)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %s: %v\n%s", strings.Join(args, " "), err, out)
	}
	return strings.TrimSpace(string(out))
}

// NewRepo creates a work repo with a bare remote under t.TempDir().
func NewRepo(t *testing.T) *Repo {
	t.Helper()
	root := t.TempDir()
	r := &Repo{t: t, Work: filepath.Join(root, "work"), Remote: filepath.Join(root, "remote.git")}
	Git(t, root, "init", "-q", "--bare", "-b", "main", r.Remote)
	Git(t, r.Remote, "config", "uploadpack.allowAnySHA1InWant", "true")
	Git(t, root, "init", "-q", "-b", "main", r.Work)
	Git(t, r.Work, "remote", "add", "origin", r.Remote)
	return r
}

// Commit syncs to the remote main, writes files (nil content deletes), commits, pushes to main, and
// returns the new commit sha.
func (r *Repo) Commit(msg string, files map[string]*string) string {
	r.t.Helper()
	// Start from the remote's main (others may have pushed).
	Git(r.t, r.Work, "fetch", "-q", "origin")
	cmd := exec.Command("git", "rev-parse", "--verify", "-q", "origin/main")
	cmd.Dir = r.Work
	if cmd.Run() == nil {
		Git(r.t, r.Work, "reset", "-q", "--hard", "origin/main")
	}
	for p, c := range files {
		full := filepath.Join(r.Work, filepath.FromSlash(p))
		if c == nil {
			if err := os.RemoveAll(full); err != nil {
				r.t.Fatal(err)
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			r.t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(*c), 0o644); err != nil {
			r.t.Fatal(err)
		}
	}
	Git(r.t, r.Work, "add", "-A")
	Git(r.t, r.Work, "commit", "-q", "--allow-empty", "-m", msg)
	Git(r.t, r.Work, "push", "-q", "origin", "HEAD:refs/heads/main")
	return Git(r.t, r.Work, "rev-parse", "HEAD")
}

// S returns a pointer to s.
func S(s string) *string { return &s }

// Files builds a commit map from alternating path, content pairs.
func Files(kv ...string) map[string]*string {
	m := make(map[string]*string, len(kv)/2)
	for i := 0; i+1 < len(kv); i += 2 {
		m[kv[i]] = S(kv[i+1])
	}
	return m
}

// TestdataDir returns containers/workcell/testdata.
func TestdataDir() string {
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "..", "..", "testdata")
}

// RequireNode skips the test when node is not installed.
func RequireNode(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("node not installed")
	}
}
