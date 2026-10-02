// Package integrator implements the integrator role: building promotion
// commits with git plumbing (/integrate), post-land CI (/ci), and seeding.
package integrator

import (
	"archive/tar"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"livemain/workcell/internal/apierr"
	"livemain/workcell/internal/gitstore"
	"livemain/workcell/internal/merge"
	"livemain/workcell/internal/sigdiff"
	"livemain/workcell/internal/testrun"
	"livemain/workcell/internal/workspace"
)

// Config holds shared dependencies.
type Config struct {
	DataDir string
	DepsDir string
	Mirror  *gitstore.Mirror
	Merger  *merge.Merger
	Sigdiff *sigdiff.Client
	Tests   *testrun.Runner
}

// Integrator is the single writer of refs/heads/main.
type Integrator struct {
	cfg Config
	mu  sync.Mutex // serializes /integrate and /seed
}

// New creates an integrator.
func New(cfg Config) *Integrator { return &Integrator{cfg: cfg} }

const mainRef = "refs/heads/main"

// Change is one overlay change (nil content = delete).
type Change struct {
	Path    string  `json:"path"`
	Content *string `json:"content"`
}

// IntegrateRequest is the POST /integrate body.
type IntegrateRequest struct {
	Remote           string              `json:"remote"`
	ExpectedHeadSha  string              `json:"expectedHeadSha"`
	PinSha           string              `json:"pinSha"`
	Changes          []Change            `json:"changes"`
	AutoMerge        []string            `json:"autoMerge"`
	ImpactTests      []string            `json:"impactTests"`
	ImpactCandidates map[string][]string `json:"impactCandidates"`
	Message          string              `json:"message"`
	Author           string              `json:"author"`
	TimeoutMs        int64               `json:"timeoutMs"`
	// Prefer is a commit to land instead of the built one when they are equivalent (its only
	// parent is the head and its tree is the built tree): a person's pushed commit then lands
	// as itself, so their clone stays in sync with main.
	Prefer string `json:"prefer,omitempty"`
}

// Merged records an auto-merged path.
type Merged struct {
	Path   string `json:"path"`
	Method string `json:"method"`
}

// IntegrateResult is the success response.
type IntegrateResult struct {
	OK           bool              `json:"ok"`
	Sha          string            `json:"sha"`
	Parent       string            `json:"parent"`
	ChangedPaths []string          `json:"changedPaths"`
	Classes      map[string]string `json:"classes"`
	Merged       []Merged          `json:"merged"`
	Impact       *testrun.Result   `json:"impact"`
	ImpactRan    []string          `json:"impactRan"`
}

func badGateway(code string, err error) error {
	return apierr.New(http.StatusBadGateway, code, "%v", err)
}

// Integrate applies an overlay on top of main and pushes it fast-forward.
func (in *Integrator) Integrate(ctx context.Context, req IntegrateRequest) (*IntegrateResult, error) {
	if req.Remote == "" || !gitstore.IsSHA(req.ExpectedHeadSha) || !gitstore.IsSHA(req.PinSha) {
		return nil, apierr.BadRequest("remote, expectedHeadSha and pinSha (full shas) are required")
	}
	if req.Message == "" {
		req.Message = "promote"
	}
	changes := make(map[string]*string, len(req.Changes))
	for _, c := range req.Changes {
		p, err := workspace.CleanPath(c.Path, false)
		if err != nil {
			return nil, err
		}
		changes[p] = c.Content
	}
	in.mu.Lock()
	defer in.mu.Unlock()
	mirror := in.cfg.Mirror

	head, err := mirror.RemoteRef(ctx, req.Remote, mainRef)
	if err != nil {
		return nil, badGateway("remote-error", err)
	}
	if head != req.ExpectedHeadSha {
		return nil, apierr.Conflict("head-moved", "remote main is %s, expected %s", head, req.ExpectedHeadSha).With("headSha", head)
	}
	if err := mirror.Fetch(ctx, req.Remote, req.ExpectedHeadSha, req.PinSha); err != nil {
		return nil, badGateway("fetch-failed", err)
	}
	pinIdx, err := mirror.Index(ctx, req.PinSha)
	if err != nil {
		return nil, err
	}
	headIdx, err := mirror.Index(ctx, head)
	if err != nil {
		return nil, err
	}
	deltaList, err := mirror.DiffNames(ctx, req.PinSha, head)
	if err != nil {
		return nil, err
	}
	delta := make(map[string]bool, len(deltaList))
	for _, p := range deltaList {
		delta[p] = true
	}
	autoMerge := make(map[string]bool, len(req.AutoMerge))
	for _, p := range req.AutoMerge {
		autoMerge[p] = true
	}

	// Step 2: decide the content of every changed path.
	final := make(map[string]*string, len(changes))
	merged := []Merged{}
	var needs []string
	isGenerated := in.generatedMatcher(ctx, headIdx)
	paths := sortedPaths(changes)
	for _, p := range paths {
		content := changes[p]
		if !delta[p] {
			final[p] = content
			continue
		}
		if isGenerated(p) {
			// Never text-merge generated files: keep main's version; regeneration (step 3b)
			// brings it in line with the merged sources.
			merged = append(merged, Merged{Path: p, Method: "regenerate"})
			continue
		}
		if !autoMerge[p] {
			needs = append(needs, p)
			continue
		}
		out, method, ok, err := in.autoMerge(ctx, p, pinIdx, headIdx, content)
		if err != nil {
			return nil, err
		}
		if !ok {
			needs = append(needs, p)
			continue
		}
		s := string(out)
		final[p] = &s
		merged = append(merged, Merged{Path: p, Method: method})
	}
	if len(needs) > 0 {
		return nil, apierr.Conflict("needs-checkpoint", "paths changed on main since the pin: %s", strings.Join(needs, ", ")).With("paths", needs)
	}

	// Step 3: build the commit with plumbing.
	newSha, err := in.buildCommit(ctx, head, headIdx, final, req.Message, req.Author)
	if err != nil {
		return nil, err
	}
	// Step 3b: regenerate generated files on the merged tree (if the repo defines how).
	if newSha != head {
		regenerated, changed, err := in.regenerate(ctx, head, newSha, req.Message, req.Author)
		if err != nil {
			return nil, err
		}
		if changed {
			newSha = regenerated
		}
	}
	if req.Prefer != "" && newSha != head && in.equivalent(ctx, req.Remote, req.Prefer, newSha, head) {
		newSha = req.Prefer
	}
	res := &IntegrateResult{OK: true, Sha: newSha, Parent: head, ChangedPaths: []string{}, Classes: map[string]string{}, Merged: merged, ImpactRan: []string{}}
	if newSha == head {
		// Overlay identical to main: nothing to land.
		res.Parent = ""
		if parent, err := mirror.Git(ctx, "rev-parse", "--verify", "-q", head+"^"); err == nil {
			res.Parent = parent
		}
		return res, nil
	}
	newIdx, err := mirror.Index(ctx, newSha)
	if err != nil {
		return nil, err
	}

	// Step 4: classify every changed path of the new commit.
	changed, err := mirror.DiffNames(ctx, head, newSha)
	if err != nil {
		return nil, err
	}
	res.ChangedPaths = append(res.ChangedPaths, changed...)
	for _, p := range changed {
		oldB, oldOK, err := blobAt(ctx, mirror, headIdx, p)
		if err != nil {
			return nil, err
		}
		newB, newOK, err := blobAt(ctx, mirror, newIdx, p)
		if err != nil {
			return nil, err
		}
		res.Classes[p] = in.cfg.Sigdiff.Diff(ctx, p, oldB, oldOK, newB, newOK).Class
	}

	// Step 5: impact tests on the materialized tree.
	tests := impactSet(req.ImpactTests, req.ImpactCandidates, res.Classes, newIdx)
	if len(tests) > 0 {
		result, err := in.runTree(ctx, newSha, tests, time.Duration(req.TimeoutMs)*time.Millisecond)
		if err != nil {
			return nil, err
		}
		res.Impact, res.ImpactRan = result, tests
		if !result.OK {
			return nil, apierr.Conflict("impact-failed", "impact tests failed on the merged tree").With("results", result).With("impactRan", tests)
		}
	}

	// Step 6: fast-forward push (non-force: acts as compare-and-swap).
	if err := in.push(ctx, req.Remote, newSha, head); err != nil {
		return nil, err
	}
	return res, nil
}

// equivalent reports whether commit has exactly one parent, head, and the same tree as built.
func (in *Integrator) equivalent(ctx context.Context, remote, commit, built, head string) bool {
	mirror := in.cfg.Mirror
	if !gitstore.IsSHA(commit) || mirror.Fetch(ctx, remote, commit) != nil {
		return false
	}
	parents, err := mirror.Git(ctx, "rev-list", "--parents", "-n", "1", commit)
	if err != nil || strings.Join(strings.Fields(parents)[1:], " ") != head {
		return false
	}
	a, errA := mirror.Git(ctx, "rev-parse", commit+"^{tree}")
	b, errB := mirror.Git(ctx, "rev-parse", built+"^{tree}")
	return errA == nil && errB == nil && a == b
}

func sortedPaths[T any](m map[string]T) []string {
	out := make([]string, 0, len(m))
	for p := range m {
		out = append(out, p)
	}
	sort.Strings(out)
	return out
}

func blobAt(ctx context.Context, mirror *gitstore.Mirror, idx *gitstore.TreeIndex, p string) ([]byte, bool, error) {
	e, ok := idx.Lookup(p)
	if !ok || e.Type != gitstore.TypeBlob {
		return nil, false, nil
	}
	b, err := mirror.Blob(ctx, e.SHA)
	return b, err == nil, err
}

// autoMerge merges an allowed path: both sides must be additive (or no-op)
// per sigdiff, and the merge chain must be clean.
func (in *Integrator) autoMerge(ctx context.Context, p string, pinIdx, headIdx *gitstore.TreeIndex, content *string) ([]byte, string, bool, error) {
	if content == nil {
		return nil, "", false, nil // deletions are never auto-merged
	}
	base, baseOK, err := blobAt(ctx, in.cfg.Mirror, pinIdx, p)
	if err != nil {
		return nil, "", false, err
	}
	theirs, theirsOK, err := blobAt(ctx, in.cfg.Mirror, headIdx, p)
	if err != nil {
		return nil, "", false, err
	}
	if !theirsOK {
		return nil, "", false, nil // deleted on main
	}
	ours := []byte(*content)
	for _, side := range []struct {
		b  []byte
		ok bool
	}{{ours, true}, {theirs, theirsOK}} {
		class := in.cfg.Sigdiff.Diff(ctx, p, base, baseOK, side.b, side.ok).Class
		if class != sigdiff.ClassNone && class != sigdiff.ClassAdditive {
			return nil, "", false, nil
		}
	}
	res, err := in.cfg.Merger.Merge(ctx, p, base, ours, theirs)
	if err != nil {
		return nil, "", false, err
	}
	return res.Content, res.Method, res.Clean, nil
}

func impactSet(always []string, candidates map[string][]string, classes map[string]string, idx *gitstore.TreeIndex) []string {
	seen := map[string]bool{}
	var out []string
	add := func(t string) {
		p, err := workspace.CleanPath(t, false)
		if err != nil || seen[p] {
			return
		}
		seen[p] = true
		if e, ok := idx.Lookup(p); ok && e.Type == gitstore.TypeBlob {
			out = append(out, p)
		}
	}
	for _, t := range always {
		add(t)
	}
	for _, p := range sortedPaths(classes) {
		if c := classes[p]; c == sigdiff.ClassBody || c == sigdiff.ClassSignature {
			for _, t := range candidates[p] {
				add(t)
			}
		}
	}
	return out
}

// buildCommit writes a commit on top of parent with the given path contents
// (no working tree). Returns parent when the tree is unchanged.
func (in *Integrator) buildCommit(ctx context.Context, parent string, parentIdx *gitstore.TreeIndex, final map[string]*string, message, author string) (string, error) {
	return in.cfg.Mirror.CommitChanges(ctx, parent, parentIdx, final, message, author, "livemain-integrator <integrator@livemain>")
}

func (in *Integrator) push(ctx context.Context, remote, sha, expected string) error {
	out, err := gitstore.RunCombined(ctx, gitstore.Cmd{Dir: in.cfg.Mirror.Dir, Args: []string{"push", "--porcelain", remote, sha + ":" + mainRef}})
	if err == nil {
		return nil
	}
	if strings.Contains(out, "[rejected]") || strings.Contains(out, "[remote rejected]") || strings.Contains(out, "non-fast-forward") || strings.Contains(out, "fetch first") {
		head, _ := in.cfg.Mirror.RemoteRef(ctx, remote, mainRef)
		return apierr.Conflict("head-moved", "push rejected: remote main moved past %s", expected).With("headSha", head)
	}
	return apierr.New(http.StatusBadGateway, "push-failed", "%s", strings.TrimSpace(out))
}

// materialize extracts commit sha into a fresh scratch dir with a
// node_modules symlink. The caller removes the returned dir.
func (in *Integrator) materialize(ctx context.Context, sha string) (string, error) {
	scratch := filepath.Join(in.cfg.DataDir, "scratch")
	if err := os.MkdirAll(scratch, 0o755); err != nil {
		return "", err
	}
	dir, err := os.MkdirTemp(scratch, "tree-*")
	if err != nil {
		return "", err
	}
	// Tests may run as an unprivileged per-workspace uid: the tree must be readable.
	if err := os.Chmod(dir, 0o755); err != nil {
		os.RemoveAll(dir)
		return "", err
	}
	if err := extractTree(ctx, in.cfg.Mirror.Dir, sha, dir); err != nil {
		os.RemoveAll(dir)
		return "", err
	}
	if err := os.Symlink(in.cfg.DepsDir, filepath.Join(dir, "node_modules")); err != nil && !errors.Is(err, os.ErrExist) {
		os.RemoveAll(dir)
		return "", err
	}
	return dir, nil
}

// extractTree streams `git archive` into dir.
func extractTree(ctx context.Context, gitDir, sha, dir string) error {
	cmd := exec.CommandContext(ctx, "git", "archive", "--format=tar", sha)
	cmd.Dir = gitDir
	cmd.Env = gitstore.Env()
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	tr := tar.NewReader(stdout)
	var extractErr error
	for {
		h, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			extractErr = err
			break
		}
		name := filepath.Clean(h.Name)
		if name == "." || strings.HasPrefix(name, "..") || filepath.IsAbs(name) {
			continue
		}
		target := filepath.Join(dir, name)
		switch h.Typeflag {
		case tar.TypeDir:
			extractErr = os.MkdirAll(target, 0o755)
		case tar.TypeSymlink:
			if extractErr = os.MkdirAll(filepath.Dir(target), 0o755); extractErr == nil {
				extractErr = os.Symlink(h.Linkname, target)
			}
		case tar.TypeReg:
			if extractErr = os.MkdirAll(filepath.Dir(target), 0o755); extractErr == nil {
				var f *os.File
				if f, extractErr = os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(h.Mode&0o777)); extractErr == nil {
					_, extractErr = io.Copy(f, tr)
					if cerr := f.Close(); extractErr == nil {
						extractErr = cerr
					}
				}
			}
		}
		if extractErr != nil {
			break
		}
	}
	if extractErr != nil {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		return extractErr
	}
	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("git archive %s: %v: %s", sha, err, stderr.String())
	}
	return nil
}

func (in *Integrator) runTree(ctx context.Context, sha string, files []string, timeout time.Duration) (*testrun.Result, error) {
	dir, err := in.materialize(ctx, sha)
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	return in.cfg.Tests.Run(ctx, dir, files, timeout, filepath.Join(in.cfg.DataDir, "cache", "_integrator"))
}

// CIRequest is the POST /ci body.
type CIRequest struct {
	Remote    string   `json:"remote"`
	Sha       string   `json:"sha"`
	Files     []string `json:"files"`
	TimeoutMs int64    `json:"timeoutMs"`
}

// CIResult is a test result plus the sha.
type CIResult struct {
	*testrun.Result
	Sha string `json:"sha"`
}

// CI runs the test suite (or files) on a commit.
func (in *Integrator) CI(ctx context.Context, req CIRequest) (*CIResult, error) {
	if !gitstore.IsSHA(req.Sha) {
		return nil, apierr.BadRequest("sha must be a full commit id")
	}
	files := make([]string, 0, len(req.Files))
	for _, f := range req.Files {
		p, err := workspace.CleanPath(f, false)
		if err != nil {
			return nil, err
		}
		files = append(files, p)
	}
	if err := in.cfg.Mirror.Fetch(ctx, req.Remote, req.Sha); err != nil {
		return nil, badGateway("fetch-failed", err)
	}
	res, err := in.runTree(ctx, req.Sha, files, time.Duration(req.TimeoutMs)*time.Millisecond)
	if err != nil {
		return nil, err
	}
	return &CIResult{Result: res, Sha: req.Sha}, nil
}

// SeedRequest is the POST /seed body. The root commit of main comes from exactly one source:
// a directory inside the image, inline files, or a git URL (its default branch, with history).
type SeedRequest struct {
	Remote  string            `json:"remote"`
	Dir     string            `json:"dir,omitempty"`
	Files   map[string]string `json:"files,omitempty"`
	URL     string            `json:"url,omitempty"`
	Message string            `json:"message"`
}

// Seed creates main on an empty remote (hosts without commit creation, like Artifacts, are
// seeded this way).
func (in *Integrator) Seed(ctx context.Context, req SeedRequest) (string, error) {
	sources := 0
	for _, set := range []bool{req.Dir != "", len(req.Files) > 0, req.URL != ""} {
		if set {
			sources++
		}
	}
	if req.Remote == "" || sources != 1 {
		return "", apierr.BadRequest("remote and exactly one of dir, files or url are required")
	}
	if req.Dir != "" {
		if fi, err := os.Stat(req.Dir); err != nil || !fi.IsDir() {
			return "", apierr.BadRequest("dir %q is not a directory", req.Dir)
		}
	}
	if req.Message == "" {
		req.Message = "seed"
	}
	in.mu.Lock()
	defer in.mu.Unlock()
	mirror := in.cfg.Mirror
	if head, err := mirror.RemoteRef(ctx, req.Remote, mainRef); err != nil {
		return "", badGateway("remote-error", err)
	} else if head != "" {
		return "", apierr.Conflict("already-seeded", "remote main already exists at %s", head).With("sha", head)
	}
	switch {
	case req.URL != "":
		return in.seedFromURL(ctx, req.Remote, req.URL)
	case len(req.Files) > 0:
		dir, err := writeFiles(req.Files)
		if err != nil {
			return "", err
		}
		defer os.RemoveAll(dir)
		req.Dir = dir
	}
	tmp, err := os.CreateTemp("", "livemain-seed-index-*")
	if err != nil {
		return "", err
	}
	tmp.Close()
	os.Remove(tmp.Name())
	defer os.Remove(tmp.Name())
	env := []string{"GIT_INDEX_FILE=" + tmp.Name(), "GIT_WORK_TREE=" + req.Dir, "GIT_DIR=" + mirror.Dir}
	run := func(stdin io.Reader, extra []string, args ...string) (string, error) {
		out, err := gitstore.Run(ctx, gitstore.Cmd{Dir: req.Dir, Env: append(env, extra...), Stdin: stdin, Args: args})
		return strings.TrimSpace(string(out)), err
	}
	if _, err := run(nil, nil, "add", "-A", "--", ".", ":(exclude,glob)**/node_modules/**", ":(exclude,glob)**/node_modules"); err != nil {
		return "", err
	}
	tree, err := run(nil, nil, "write-tree")
	if err != nil {
		return "", err
	}
	ident := []string{
		"GIT_AUTHOR_NAME=livemain-seed", "GIT_AUTHOR_EMAIL=seed@livemain",
		"GIT_COMMITTER_NAME=livemain-seed", "GIT_COMMITTER_EMAIL=seed@livemain",
	}
	sha, err := run(strings.NewReader(req.Message), ident, "commit-tree", tree)
	if err != nil {
		return "", err
	}
	if err := in.push(ctx, req.Remote, sha, ""); err != nil {
		return "", err
	}
	return sha, nil
}

// seedFromURL fetches url's default branch into the mirror and pushes it as main.
func (in *Integrator) seedFromURL(ctx context.Context, remote, rawURL string) (string, error) {
	if u, err := url.Parse(rawURL); err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
		return "", apierr.BadRequest("url must be an http(s) git URL")
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	git := func(args ...string) (string, error) {
		out, err := gitstore.Run(ctx, gitstore.Cmd{Dir: in.cfg.Mirror.Dir, Args: args})
		return strings.TrimSpace(string(out)), err
	}
	if _, err := git("fetch", "--no-tags", "-q", rawURL, "HEAD"); err != nil {
		return "", apierr.BadRequest("fetch %s failed: %v", rawURL, err)
	}
	sha, err := git("rev-parse", "FETCH_HEAD")
	if err != nil {
		return "", err
	}
	if err := in.push(ctx, remote, sha, ""); err != nil {
		return "", err
	}
	return sha, nil
}

// writeFiles materializes inline seed files in a temp dir (the caller removes it).
func writeFiles(files map[string]string) (string, error) {
	dir, err := os.MkdirTemp("", "livemain-seed-files-*")
	if err != nil {
		return "", err
	}
	for p, content := range files {
		clean := filepath.ToSlash(filepath.Clean(p))
		if p == "" || filepath.IsAbs(p) || clean != p || strings.HasPrefix(clean, "../") || clean == ".." || clean == ".git" || strings.HasPrefix(clean, ".git/") {
			os.RemoveAll(dir)
			return "", apierr.BadRequest("invalid path %q", p)
		}
		full := filepath.Join(dir, filepath.FromSlash(clean))
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			os.RemoveAll(dir)
			return "", err
		}
		if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
			os.RemoveAll(dir)
			return "", err
		}
	}
	return dir, nil
}
