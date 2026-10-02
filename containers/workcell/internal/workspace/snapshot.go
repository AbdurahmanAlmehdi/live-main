package workspace

import (
	"context"
	"fmt"
	"strings"

	"livemain/workcell/internal/apierr"
	"livemain/workcell/internal/gitstore"
)

// SnapshotRequest is the body of POST /workspaces/:id/snapshot.
type SnapshotRequest struct {
	// Remote to push to: the main repo, or a per-agent fork.
	Remote string `json:"remote"`
	// Ref to (force-)update, default refs/heads/overlay/<workspace id>.
	Ref     string `json:"ref"`
	Message string `json:"message"`
	Author  string `json:"author"`
}

// SnapshotResult says where the overlay was published.
type SnapshotResult struct {
	Sha     string `json:"sha"`
	Parent  string `json:"parent"`
	Ref     string `json:"ref"`
	Changes int    `json:"changes"`
}

// Snapshot commits the overlay on top of its pinned base and force-pushes it to a ref,
// so every agent's work in progress is an ordinary, cloneable git commit.
func (m *Manager) Snapshot(ctx context.Context, w *Workspace, req SnapshotRequest) (*SnapshotResult, error) {
	if err := w.requireLivefs(); err != nil {
		return nil, err
	}
	if req.Remote == "" {
		return nil, apierr.BadRequest("remote is required")
	}
	ref := req.Ref
	if ref == "" {
		ref = "refs/heads/overlay/" + w.ID
	}
	if !strings.HasPrefix(ref, "refs/heads/") || ref == "refs/heads/main" || checkRefName(strings.TrimPrefix(ref, "refs/heads/")) != nil {
		return nil, apierr.BadRequest("invalid snapshot ref %q", ref)
	}
	if err := w.readLock(); err != nil {
		return nil, err
	}
	defer w.apiMu.RUnlock()
	changes, err := w.mount.U.Changes()
	if err != nil {
		return nil, err
	}
	pinIdx, err := m.cfg.Mirror.Index(ctx, w.pinSha)
	if err != nil {
		return nil, err
	}
	final := make(map[string]*string, len(changes))
	for _, c := range changes {
		final[c.Path] = c.Content
	}
	message := req.Message
	if message == "" {
		message = fmt.Sprintf("overlay %s on %s", w.ID, w.pinSha[:min(10, len(w.pinSha))])
	}
	author := req.Author
	if author == "" {
		author = fmt.Sprintf("%s <%s@livemain>", w.ID, w.ID)
	}
	// Parents: the pinned base, plus the previous snapshot if any. Every update is then a
	// fast-forward (remotes may deny non-fast-forward pushes) and the ref keeps the agent's
	// history: how its work evolved as main moved under it.
	var extra []string
	if prev, err := m.cfg.Mirror.RemoteRef(ctx, req.Remote, ref); err == nil && prev != "" {
		if err := m.cfg.Mirror.Fetch(ctx, req.Remote, prev); err == nil {
			extra = append(extra, prev)
		}
	}
	sha, err := m.cfg.Mirror.CommitChanges(ctx, w.pinSha, pinIdx, final, message, author, "livemain-workcell <workcell@livemain>", extra...)
	if err != nil {
		return nil, err
	}
	out, err := gitstore.RunCombined(ctx, gitstore.Cmd{Dir: m.cfg.Mirror.Dir, Args: []string{"push", "--porcelain", req.Remote, sha + ":" + ref}})
	if err != nil {
		return nil, apierr.New(502, "push-failed", "%s", strings.TrimSpace(out))
	}
	return &SnapshotResult{Sha: sha, Parent: w.pinSha, Ref: ref, Changes: len(changes)}, nil
}
