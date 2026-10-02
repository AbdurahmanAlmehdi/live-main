// Package testrun runs vitest with the JSON reporter and normalizes results.
package testrun

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"
)

// Failure is one failed test.
type Failure struct {
	Name    string `json:"name"`
	Message string `json:"message"`
}

// FileResult is the outcome of one test file.
type FileResult struct {
	File     string    `json:"file"`
	OK       bool      `json:"ok"`
	Failures []Failure `json:"failures"`
}

// Result is the /test response shape.
type Result struct {
	OK         bool         `json:"ok"`
	Passed     int          `json:"passed"`
	Failed     int          `json:"failed"`
	Files      []FileResult `json:"files"`
	Output     string       `json:"output"`
	DurationMs int64        `json:"durationMs"`
}

// Runner executes vitest from a shared node_modules.
type Runner struct {
	DepsDir string // the node_modules dir (LIVEMAIN_DEPS)
	Node    string
	// Isolate runs each workspace's tests as its own unprivileged uid (derived from the
	// cache dir), so agents sharing a workcell cannot touch each other's files or
	// processes. Only effective when the server runs as root.
	Isolate bool
}

// uidBase..uidBase+uidRange are the per-workspace test uids.
const (
	uidBase  = 20000
	uidRange = 30000
)

// IsolatedUID is the uid that runs tests for the workspace owning cacheDir.
func IsolatedUID(cacheDir string) uint32 {
	h := uint32(2166136261)
	for i := 0; i < len(cacheDir); i++ {
		h = (h ^ uint32(cacheDir[i])) * 16777619
	}
	return uidBase + h%uidRange
}

// chownTree hands dir (recursively) to uid.
func chownTree(dir string, uid uint32) error {
	return filepath.WalkDir(dir, func(p string, _ os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		return os.Lchown(p, int(uid), int(uid))
	})
}

// DefaultTimeout applies when a request gives none.
const DefaultTimeout = 120 * time.Second

const outputTail = 8 << 10

// Run executes `node <deps>/vitest/vitest.mjs run <files> --reporter=json`
// in cwd. cacheDir is exported as LIVEMAIN_CACHE_DIR.
func (r *Runner) Run(ctx context.Context, cwd string, files []string, timeout time.Duration, cacheDir string) (*Result, error) {
	if timeout <= 0 {
		timeout = DefaultTimeout
	}
	tmp, err := os.MkdirTemp("", "livemain-vitest-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmp)
	if cacheDir != "" {
		if err := os.MkdirAll(cacheDir, 0o755); err != nil {
			return nil, err
		}
	}
	report := filepath.Join(tmp, "report.json")
	node := r.Node
	if node == "" {
		node = "node"
	}
	args := []string{filepath.Join(r.DepsDir, "vitest", "vitest.mjs"), "run"}
	args = append(args, files...)
	args = append(args, "--reporter=json", "--outputFile="+report)

	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	// Enter cwd from a shell after exec rather than via cmd.Dir: cmd.Dir makes the
	// forked child chdir before exec, and when cwd is this process's own FUSE mount
	// that lookup can deadlock against the paused parent (seen under CPU emulation).
	cmd := exec.Command("/bin/sh", append([]string{"-c", `cd "$0" && exec "$@"`, cwd, node}, args...)...)
	cmd.Env = append(os.Environ(),
		"LIVEMAIN_CACHE_DIR="+cacheDir,
		"CI=1", "NO_COLOR=1", "FORCE_COLOR=0",
		"TMPDIR="+tmp,
	)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if r.Isolate && os.Geteuid() == 0 {
		uid := IsolatedUID(cacheDir)
		for _, d := range []string{tmp, cacheDir} {
			if d == "" {
				continue
			}
			if err := chownTree(d, uid); err != nil {
				return nil, fmt.Errorf("isolate: %w", err)
			}
		}
		cmd.SysProcAttr.Credential = &syscall.Credential{Uid: uid, Gid: uid, NoSetGroups: true}
		cmd.Env = append(cmd.Env, "HOME="+tmp)
	}
	out := &tailBuffer{max: outputTail}
	cmd.Stdout, cmd.Stderr = out, out

	start := time.Now()
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start vitest: %w", err)
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	var waitErr error
	timedOut := false
	select {
	case waitErr = <-done:
	case <-runCtx.Done():
		timedOut = ctx.Err() == nil
		_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		waitErr = <-done
	}
	res := &Result{DurationMs: time.Since(start).Milliseconds(), Files: []FileResult{}}
	parseErr := parseReport(report, cwd, res)
	if timedOut {
		out.WriteString(fmt.Sprintf("\n[livemain] test run timed out after %s\n", timeout))
	}
	res.Output = out.String()
	if parseErr != nil {
		res.OK = false
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return res, nil
	}
	exitOK := waitErr == nil
	res.OK = exitOK && !timedOut && res.Failed == 0 && allFilesOK(res.Files)
	return res, nil
}

func allFilesOK(files []FileResult) bool {
	for _, f := range files {
		if !f.OK {
			return false
		}
	}
	return true
}

type vitestReport struct {
	NumPassedTests int `json:"numPassedTests"`
	NumFailedTests int `json:"numFailedTests"`
	TestResults    []struct {
		Name             string `json:"name"`
		Status           string `json:"status"`
		Message          string `json:"message"`
		AssertionResults []struct {
			FullName        string   `json:"fullName"`
			Title           string   `json:"title"`
			Status          string   `json:"status"`
			FailureMessages []string `json:"failureMessages"`
		} `json:"assertionResults"`
	} `json:"testResults"`
}

func parseReport(path, cwd string, res *Result) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var rep vitestReport
	if err := json.Unmarshal(data, &rep); err != nil {
		return err
	}
	res.Passed, res.Failed = rep.NumPassedTests, rep.NumFailedTests
	res.Files = make([]FileResult, 0, len(rep.TestResults))
	for _, tr := range rep.TestResults {
		fr := FileResult{File: relPath(cwd, tr.Name), OK: tr.Status == "passed", Failures: []Failure{}}
		for _, a := range tr.AssertionResults {
			if a.Status == "failed" {
				name := a.FullName
				if name == "" {
					name = a.Title
				}
				fr.Failures = append(fr.Failures, Failure{Name: name, Message: truncate(strings.Join(a.FailureMessages, "\n"), 2048)})
			}
		}
		if !fr.OK && len(fr.Failures) == 0 {
			msg := tr.Message
			if msg == "" {
				msg = "test file failed (status " + tr.Status + ")"
			}
			fr.Failures = append(fr.Failures, Failure{Name: fr.File, Message: truncate(msg, 2048)})
		}
		res.Files = append(res.Files, fr)
	}
	sort.Slice(res.Files, func(i, j int) bool { return res.Files[i].File < res.Files[j].File })
	return nil
}

func relPath(cwd, name string) string {
	for _, base := range []string{cwd, evalSymlinks(cwd)} {
		if base == "" {
			continue
		}
		if rel, err := filepath.Rel(base, name); err == nil && !strings.HasPrefix(rel, "..") {
			return filepath.ToSlash(rel)
		}
	}
	return name
}

func evalSymlinks(p string) string {
	r, err := filepath.EvalSymlinks(p)
	if err != nil {
		return ""
	}
	return r
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}

// tailBuffer keeps the last max bytes written to it.
type tailBuffer struct {
	mu  sync.Mutex
	max int
	buf bytes.Buffer
	cut bool
}

func (t *tailBuffer) Write(p []byte) (int, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.buf.Write(p)
	if t.buf.Len() > 2*t.max {
		b := t.buf.Bytes()
		keep := append([]byte(nil), b[len(b)-t.max:]...)
		t.buf.Reset()
		t.buf.Write(keep)
		t.cut = true
	}
	return len(p), nil
}

func (t *tailBuffer) WriteString(s string) { _, _ = t.Write([]byte(s)) }

func (t *tailBuffer) String() string {
	t.mu.Lock()
	defer t.mu.Unlock()
	b := t.buf.Bytes()
	if len(b) > t.max {
		b = b[len(b)-t.max:]
		return "..." + string(b)
	}
	if t.cut {
		return "..." + string(b)
	}
	return string(b)
}

// ErrNoVitest is returned when the deps dir lacks vitest.
var ErrNoVitest = errors.New("vitest not found in LIVEMAIN_DEPS")

// Check verifies vitest is installed.
func (r *Runner) Check() error {
	if _, err := os.Stat(filepath.Join(r.DepsDir, "vitest", "vitest.mjs")); err != nil {
		return ErrNoVitest
	}
	return nil
}
