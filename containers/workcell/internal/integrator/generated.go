package integrator

import (
	"context"
	"os"
	"os/exec"
	"strings"
	"time"

	"livemain/workcell/internal/apierr"
	"livemain/workcell/internal/gitstore"
	"livemain/workcell/internal/merge"
)

// Generated files and lockfiles are regenerated after a merge, never text-merged.
//
//   - A path is generated per merge.GeneratedMatcher (lockfiles, plus paths marked
//     `linguist-generated` in main's .gitattributes).
//   - If such a path changed on main since the pin, the promotion takes main's version
//     instead of merging, and relies on regeneration.
//   - If the merged tree contains `scripts/livemain-regen`, it runs (sh, repo root as cwd,
//     node_modules available) on the materialized tree and whatever it rewrites is folded
//     into the promoted commit.

const (
	regenScript  = "scripts/livemain-regen"
	regenTimeout = 2 * time.Minute
)

// generatedMatcher reads the generated-path globs from a tree.
func (in *Integrator) generatedMatcher(ctx context.Context, idx *gitstore.TreeIndex) func(string) bool {
	list, _, _ := blobAt(ctx, in.cfg.Mirror, idx, merge.GeneratedListPath)
	return merge.GeneratedMatcher(list)
}

// regenerate runs scripts/livemain-regen on commit sha (whose parent is head) and, if it
// changed anything, returns a replacement commit on head with the regenerated tree.
func (in *Integrator) regenerate(ctx context.Context, head, sha, message, author string) (string, bool, error) {
	idx, err := in.cfg.Mirror.Index(ctx, sha)
	if err != nil {
		return "", false, err
	}
	if _, ok := idx.Lookup(regenScript); !ok {
		return sha, false, nil
	}
	dir, err := in.materialize(ctx, sha)
	if err != nil {
		return "", false, err
	}
	defer os.RemoveAll(dir)
	runCtx, cancel := context.WithTimeout(ctx, regenTimeout)
	defer cancel()
	cmd := exec.CommandContext(runCtx, "/bin/sh", regenScript)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "CI=1")
	if out, err := cmd.CombinedOutput(); err != nil {
		return "", false, apierr.Conflict("regen-failed", "%s failed: %v: %s", regenScript, err, gitstore.Truncate(string(out), 2000))
	}
	// Stage the regenerated working tree over sha's tree in a temporary index.
	tmp, err := os.CreateTemp("", "livemain-regen-index-*")
	if err != nil {
		return "", false, err
	}
	tmp.Close()
	os.Remove(tmp.Name())
	defer os.Remove(tmp.Name())
	env := []string{"GIT_INDEX_FILE=" + tmp.Name()}
	git := func(args ...string) (string, error) {
		full := append([]string{"--git-dir", in.cfg.Mirror.Dir, "--work-tree", dir}, args...)
		out, err := gitstore.Run(ctx, gitstore.Cmd{Dir: dir, Env: env, Args: full})
		return strings.TrimSpace(string(out)), err
	}
	if _, err := git("read-tree", sha); err != nil {
		return "", false, err
	}
	if _, err := git("add", "-A", "--", ".", ":(exclude)node_modules"); err != nil {
		return "", false, err
	}
	tree, err := git("write-tree")
	if err != nil {
		return "", false, err
	}
	shaTree, err := in.cfg.Mirror.Git(ctx, "rev-parse", sha+"^{tree}")
	if err != nil {
		return "", false, err
	}
	if tree == shaTree {
		return sha, false, nil
	}
	name, email := gitstore.ParseAuthor(author)
	cenv := []string{"GIT_AUTHOR_NAME=" + name, "GIT_AUTHOR_EMAIL=" + email,
		"GIT_COMMITTER_NAME=livemain-integrator", "GIT_COMMITTER_EMAIL=integrator@livemain"}
	out, err := gitstore.Run(ctx, gitstore.Cmd{Dir: in.cfg.Mirror.Dir, Env: cenv, Stdin: strings.NewReader(message + "\n\n(generated files regenerated)"),
		Args: []string{"commit-tree", tree, "-p", head}})
	if err != nil {
		return "", false, err
	}
	return strings.TrimSpace(string(out)), true, nil
}
