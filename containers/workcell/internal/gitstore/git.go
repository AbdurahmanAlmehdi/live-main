// Package gitstore wraps the git CLI: a shared bare mirror with a persistent
// `git cat-file --batch` reader, per-commit tree indexes, and plumbing helpers.
package gitstore

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
)

// baseEnv is appended to every git invocation. safe.directory=* is needed
// because seed directories and clones may be owned by another uid (bind mounts).
var baseEnv = []string{
	"GIT_TERMINAL_PROMPT=0",
	"GIT_CONFIG_NOSYSTEM=1",
	"GIT_CONFIG_COUNT=2",
	"GIT_CONFIG_KEY_0=safe.directory",
	"GIT_CONFIG_VALUE_0=*",
	"GIT_CONFIG_KEY_1=advice.detachedHead",
	"GIT_CONFIG_VALUE_1=false",
	"LC_ALL=C",
}

// Env returns os.Environ() plus the git base environment plus extra.
func Env(extra ...string) []string {
	env := append(os.Environ(), baseEnv...)
	return append(env, extra...)
}

// Cmd describes one git invocation.
type Cmd struct {
	Dir   string    // working directory ("" = inherit)
	Env   []string  // extra environment entries
	Stdin io.Reader // optional
	Args  []string
}

// GitError carries the exit status and stderr of a failed git command.
type GitError struct {
	Args     []string
	ExitCode int
	Stderr   string
	Stdout   string
}

func (e *GitError) Error() string {
	msg := strings.TrimSpace(e.Stderr)
	if msg == "" {
		msg = strings.TrimSpace(e.Stdout)
	}
	return fmt.Sprintf("git %s: exit %d: %s", strings.Join(e.Args, " "), e.ExitCode, msg)
}

// Run executes git and returns stdout. A non-zero exit yields *GitError.
func Run(ctx context.Context, c Cmd) ([]byte, error) {
	cmd := exec.CommandContext(ctx, "git", c.Args...)
	cmd.Dir = c.Dir
	cmd.Env = Env(c.Env...)
	cmd.Stdin = c.Stdin
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		code := -1
		if ee, ok := err.(*exec.ExitError); ok {
			code = ee.ExitCode()
		}
		return stdout.Bytes(), &GitError{Args: c.Args, ExitCode: code, Stderr: stderr.String(), Stdout: stdout.String()}
	}
	return stdout.Bytes(), nil
}

// RunCombined executes git and returns combined stdout+stderr (for tool output).
func RunCombined(ctx context.Context, c Cmd) (string, error) {
	cmd := exec.CommandContext(ctx, "git", c.Args...)
	cmd.Dir = c.Dir
	cmd.Env = Env(c.Env...)
	cmd.Stdin = c.Stdin
	out, err := cmd.CombinedOutput()
	if err != nil {
		code := -1
		if ee, ok := err.(*exec.ExitError); ok {
			code = ee.ExitCode()
		}
		return string(out), &GitError{Args: c.Args, ExitCode: code, Stderr: string(out)}
	}
	return string(out), nil
}

// Git runs git in dir with args and returns trimmed stdout.
func Git(ctx context.Context, dir string, args ...string) (string, error) {
	out, err := Run(ctx, Cmd{Dir: dir, Args: args})
	return strings.TrimSpace(string(out)), err
}

// IsSHA reports whether s looks like a full hex object id.
func IsSHA(s string) bool {
	if len(s) != 40 && len(s) != 64 {
		return false
	}
	for _, c := range s {
		if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f') {
			return false
		}
	}
	return true
}

// ParseAuthor splits "Name <email>" into its parts. A bare name gets a
// synthetic email.
func ParseAuthor(s string) (name, email string) {
	s = strings.TrimSpace(s)
	if i := strings.Index(s, "<"); i >= 0 {
		if j := strings.Index(s[i:], ">"); j > 0 {
			name = strings.TrimSpace(s[:i])
			email = strings.TrimSpace(s[i+1 : i+j])
		}
	}
	if name == "" && email == "" {
		name = s
	}
	if name == "" {
		name = "livemain"
	}
	if email == "" {
		email = strings.ReplaceAll(strings.ToLower(name), " ", "-") + "@livemain"
	}
	return name, email
}
