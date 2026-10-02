package merge

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"time"
)

// Merge methods reported to callers.
const (
	MethodMergiraf  = "mergiraf"
	MethodUnion     = "union"
	MethodMergeFile = "merge-file"
)

// Result of a three-way merge. On conflict, Content holds the
// conflict-marked file (from git merge-file).
type Result struct {
	Content []byte
	Clean   bool
	Method  string
}

// Merger runs the merge chain. The zero value works (no mergiraf).
type Merger struct {
	// Mergiraf is the mergiraf binary path; empty disables it.
	Mergiraf string
	// Timeout bounds each external merge tool invocation.
	Timeout time.Duration
}

// NewMerger resolves the mergiraf binary (bin may be a name on PATH or a
// path); a missing binary disables that stage.
func NewMerger(bin string) *Merger {
	m := &Merger{Timeout: 30 * time.Second}
	if bin == "" {
		bin = "mergiraf"
	}
	if p, err := exec.LookPath(bin); err == nil {
		m.Mergiraf = p
	}
	return m
}

// HasMergiraf reports whether the mergiraf stage is enabled.
func (m *Merger) HasMergiraf() bool { return m.Mergiraf != "" }

// Merge merges ours and theirs against base for the file at repoPath
// (whose extension selects mergiraf's grammar). Absent sides should be
// passed as empty content by the caller only when that is semantically an
// empty file; deletions are handled by the caller.
func (m *Merger) Merge(ctx context.Context, repoPath string, base, ours, theirs []byte) (Result, error) {
	switch {
	case bytes.Equal(ours, theirs):
		return Result{Content: ours, Clean: true, Method: MethodMergeFile}, nil
	case bytes.Equal(base, ours):
		return Result{Content: theirs, Clean: true, Method: MethodMergeFile}, nil
	case bytes.Equal(base, theirs):
		return Result{Content: ours, Clean: true, Method: MethodMergeFile}, nil
	}
	dir, err := os.MkdirTemp("", "livemain-merge-*")
	if err != nil {
		return Result{}, err
	}
	defer os.RemoveAll(dir)
	ext := path.Ext(repoPath)
	files := map[string][]byte{"base" + ext: base, "ours" + ext: ours, "theirs" + ext: theirs}
	for name, data := range files {
		if err := os.WriteFile(filepath.Join(dir, name), data, 0o644); err != nil {
			return Result{}, err
		}
	}
	bp, op, tp := filepath.Join(dir, "base"+ext), filepath.Join(dir, "ours"+ext), filepath.Join(dir, "theirs"+ext)

	if m.Mergiraf != "" {
		if out, ok := m.mergiraf(ctx, dir, repoPath, bp, op, tp); ok {
			return Result{Content: out, Clean: true, Method: MethodMergiraf}, nil
		}
	}
	if out, ok := Union(base, ours, theirs); ok {
		return Result{Content: out, Clean: true, Method: MethodUnion}, nil
	}
	out, clean, err := m.mergeFile(ctx, op, bp, tp)
	if err != nil {
		return Result{}, err
	}
	return Result{Content: out, Clean: clean, Method: MethodMergeFile}, nil
}

func (m *Merger) withTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	if m.Timeout <= 0 {
		return ctx, func() {}
	}
	return context.WithTimeout(ctx, m.Timeout)
}

func (m *Merger) mergiraf(ctx context.Context, dir, repoPath, base, ours, theirs string) ([]byte, bool) {
	ctx, cancel := m.withTimeout(ctx)
	defer cancel()
	outPath := filepath.Join(dir, "mergiraf.out")
	cmd := exec.CommandContext(ctx, m.Mergiraf, "merge", base, ours, theirs,
		"-p", repoPath, "-o", outPath, "-x", "ours", "-s", "base", "-y", "theirs")
	// mergiraf keeps review state under the cache dir; keep it out of $HOME.
	cmd.Env = append(os.Environ(), "XDG_CACHE_HOME="+filepath.Join(dir, "cache"), "HOME="+dir)
	if err := cmd.Run(); err != nil {
		return nil, false
	}
	out, err := os.ReadFile(outPath)
	if err != nil || HasConflictMarkers(out) {
		return nil, false
	}
	return out, true
}

func (m *Merger) mergeFile(ctx context.Context, ours, base, theirs string) ([]byte, bool, error) {
	ctx, cancel := m.withTimeout(ctx)
	defer cancel()
	cmd := exec.CommandContext(ctx, "git", "merge-file", "-p", "--diff3",
		"-L", "ours", "-L", "base", "-L", "theirs", ours, base, theirs)
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	err := cmd.Run()
	if err == nil {
		return stdout.Bytes(), true, nil
	}
	var ee *exec.ExitError
	if errors.As(err, &ee) && ee.ExitCode() > 0 && ee.ExitCode() < 128 {
		return stdout.Bytes(), false, nil // exit code = number of conflicts
	}
	return nil, false, fmt.Errorf("git merge-file: %v: %s", err, stderr.String())
}

// HasConflictMarkers reports whether content contains git conflict markers.
func HasConflictMarkers(content []byte) bool {
	for _, line := range SplitLines(content) {
		if len(line) >= 7 {
			switch line[:7] {
			case "<<<<<<<", ">>>>>>>":
				return true
			}
		}
	}
	return false
}
