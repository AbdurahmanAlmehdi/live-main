package workspace

import (
	"context"
	"strings"

	"livemain/workcell/internal/apierr"
	"livemain/workcell/internal/gitstore"
)

// GitRequest is the POST /workspaces/:id/git body.
type GitRequest struct {
	Op        string `json:"op"`
	Message   string `json:"message"`
	Ref       string `json:"ref"`
	RemoteRef string `json:"remoteRef"`
	Force     bool   `json:"force"`
}

// Git runs a git operation in a clone workspace. Expected failures (rebase
// conflicts, rejected pushes) return ok=false with HTTP 200.
func (m *Manager) Git(ctx context.Context, w *Workspace, req GitRequest) (map[string]any, error) {
	if err := w.requireClone(); err != nil {
		return nil, err
	}
	ref := req.Ref
	if ref == "" {
		ref = "main"
	}
	if err := checkRefName(ref); err != nil {
		return nil, err
	}
	remoteRef := req.RemoteRef
	if remoteRef == "" {
		remoteRef = "refs/heads/main"
	}
	if err := checkRefName(remoteRef); err != nil {
		return nil, err
	}
	if err := w.readLock(); err != nil {
		return nil, err
	}
	defer w.apiMu.RUnlock()
	w.fsMu.Lock()
	defer w.fsMu.Unlock()

	g := &gitRunner{ctx: ctx, dir: w.Path}
	res := map[string]any{}
	switch req.Op {
	case "status":
		st := g.status()
		res["clean"], res["conflicts"], res["changed"] = st.clean, st.conflicts, st.changed
		res["ok"] = g.err == nil
	case "commit":
		if req.Message == "" {
			return nil, apierr.BadRequest("message is required")
		}
		g.run("add", "-A")
		if g.status().clean && g.err == nil {
			res["ok"], res["committed"] = true, false
			break
		}
		g.run("commit", "-q", "-m", req.Message)
		res["ok"], res["committed"] = g.err == nil, g.err == nil
		res["sha"] = g.quiet("rev-parse", "HEAD")
	case "fetch":
		g.run("fetch", "origin", ref)
		res["ok"] = g.err == nil
	case "rebase":
		g.run("rebase", "origin/"+ref)
		conflicts := g.conflicts()
		res["ok"], res["conflicts"] = g.err == nil, conflicts
	case "rebase-continue":
		g.run("add", "-A")
		g.runEnv([]string{"GIT_EDITOR=true"}, "rebase", "--continue")
		res["ok"], res["conflicts"] = g.err == nil, g.conflicts()
	case "rebase-abort":
		g.run("rebase", "--abort")
		res["ok"] = g.err == nil
	case "merge":
		g.run("merge", "--no-edit", "origin/"+ref)
		res["ok"], res["conflicts"] = g.err == nil, g.conflicts()
	case "push":
		args := []string{"push", "origin", "HEAD:" + remoteRef}
		if req.Force {
			args = []string{"push", "--force", "origin", "HEAD:" + remoteRef}
		}
		g.run(args...)
		out := g.output.String()
		rejected := g.err != nil && (strings.Contains(out, "[rejected]") || strings.Contains(out, "[remote rejected]") ||
			strings.Contains(out, "non-fast-forward") || strings.Contains(out, "fetch first"))
		res["ok"], res["rejected"] = g.err == nil, rejected
		res["sha"] = g.quiet("rev-parse", "HEAD")
	case "head":
		res["sha"] = g.quiet("rev-parse", "HEAD")
		res["branch"] = g.quiet("rev-parse", "--abbrev-ref", "HEAD")
		res["ok"] = true
	case "diff":
		// Three-dot: committed changes of this branch since the merge base.
		res["diff"] = g.capture("diff", "--no-color", "--no-ext-diff", "origin/"+ref+"...HEAD")
		res["ok"] = g.err == nil
	default:
		return nil, apierr.BadRequest("unknown git op %q", req.Op)
	}
	res["output"] = strings.TrimRight(g.output.String(), "\n")
	return res, nil
}

func checkRefName(ref string) error {
	if strings.HasPrefix(ref, "-") || strings.ContainsAny(ref, " \t\n\x00~^:?*[\\") || strings.Contains(ref, "..") {
		return apierr.BadRequest("invalid ref %q", ref)
	}
	return nil
}

// gitRunner accumulates output; after the first failure err is set (but
// later read-only calls still run, so status can be reported).
type gitRunner struct {
	ctx    context.Context
	dir    string
	output strings.Builder
	err    error
}

func (g *gitRunner) runEnv(env []string, args ...string) {
	if g.err != nil {
		return
	}
	out, err := gitstore.RunCombined(g.ctx, gitstore.Cmd{Dir: g.dir, Env: env, Args: args})
	g.output.WriteString(out)
	if err != nil {
		g.err = err
	}
}

func (g *gitRunner) run(args ...string) { g.runEnv(nil, args...) }

func (g *gitRunner) capture(args ...string) string {
	if g.err != nil {
		return ""
	}
	out, err := gitstore.Run(g.ctx, gitstore.Cmd{Dir: g.dir, Args: args})
	if err != nil {
		g.err = err
		g.output.WriteString(err.Error())
	}
	return string(out)
}

func (g *gitRunner) quiet(args ...string) string {
	s, _ := gitstore.Git(g.ctx, g.dir, args...)
	return s
}

func (g *gitRunner) conflicts() []string {
	out, _ := gitstore.Git(g.ctx, g.dir, "diff", "--name-only", "--diff-filter=U")
	return splitNonEmpty(out)
}

type statusInfo struct {
	clean     bool
	conflicts []string
	changed   []string
}

func (g *gitRunner) status() statusInfo {
	out, err := gitstore.Run(g.ctx, gitstore.Cmd{Dir: g.dir, Args: []string{"status", "--porcelain=v1", "-z", "--untracked-files=all"}})
	st := statusInfo{conflicts: []string{}, changed: []string{}}
	if err != nil {
		if g.err == nil {
			g.err = err
		}
		return st
	}
	recs := strings.Split(string(out), "\x00")
	for i := 0; i < len(recs); i++ {
		r := recs[i]
		if len(r) < 4 {
			continue
		}
		xy, p := r[:2], r[3:]
		if xy[0] == 'R' || xy[0] == 'C' {
			i++ // skip the rename source
		}
		st.changed = append(st.changed, p)
		if xy == "UU" || xy == "AA" || xy == "DD" || xy[0] == 'U' || xy[1] == 'U' {
			st.conflicts = append(st.conflicts, p)
		}
	}
	st.clean = len(st.changed) == 0
	return st
}

func splitNonEmpty(s string) []string {
	out := []string{}
	for _, l := range strings.Split(s, "\n") {
		if l = strings.TrimSpace(l); l != "" {
			out = append(out, l)
		}
	}
	return out
}
