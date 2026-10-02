package workspace

import (
	"bytes"
	"context"
	"fmt"
	"net/http"

	"livemain/workcell/internal/apierr"
	"livemain/workcell/internal/gitstore"
	"livemain/workcell/internal/livefs"
	"livemain/workcell/internal/merge"
	"livemain/workcell/internal/sigdiff"
)

// Notice kinds and merge results.
const (
	KindWriteWrite = "write-write"
	KindReadWrite  = "read-write"
	MergeMerged    = "merged"
	MergeConflict  = "conflict"
	maxNoticeDiff  = 4 << 10
)

// CheckpointResult is the POST /checkpoint response.
type CheckpointResult struct {
	FromSha    string   `json:"fromSha"`
	ToSha      string   `json:"toSha"`
	Generation uint64   `json:"generation"`
	Delta      []string `json:"delta"`
	ReadSet    []string `json:"readSet"`
	WriteSet   []string `json:"writeSet"`
	// LookupSet: files resolved (stat) but never opened — existence
	// dependencies. Extension to the contract; see README.
	LookupSet []string `json:"lookupSet"`
	Notices   []Notice `json:"notices"`
}

func strp(s string) *string { return &s }

// Checkpoint advances a livefs workspace to toSha: classify every delta
// path against the overlay (write-write → merge) and the read set
// (read-write → sigdiff severity), swap the lower layer, notify.
func (m *Manager) Checkpoint(ctx context.Context, w *Workspace, toSha string) (*CheckpointResult, error) {
	if err := w.requireLivefs(); err != nil {
		return nil, err
	}
	if !gitstore.IsSHA(toSha) {
		return nil, apierr.BadRequest("toSha must be a full commit id")
	}
	mirror := m.cfg.Mirror
	if err := mirror.Fetch(ctx, w.Remote, toSha); err != nil {
		return nil, apierr.New(http.StatusBadGateway, "fetch-failed", "%v", err)
	}

	w.apiMu.Lock() // waits for in-flight test runs
	defer w.apiMu.Unlock()
	if w.deleted {
		return nil, apierr.NotFound("workspace %q was deleted", w.ID)
	}
	u := w.mount.U
	from := w.pinSha
	res := &CheckpointResult{FromSha: from, ToSha: toSha, Delta: []string{}, Notices: []Notice{}}
	res.ReadSet = u.ReadSet()
	res.WriteSet = u.WriteSet()
	res.LookupSet = u.LookupSet()
	if from == toSha {
		res.Generation = u.Generation()
		return res, nil
	}

	delta, err := mirror.DiffNames(ctx, from, toSha)
	if err != nil {
		return nil, err
	}
	res.Delta = append(res.Delta, delta...)
	fromIdx, err := mirror.Index(ctx, from)
	if err != nil {
		return nil, err
	}
	toIdx, err := mirror.Index(ctx, toSha)
	if err != nil {
		return nil, err
	}
	readSet := toSet(res.ReadSet)
	writeSet := toSet(res.WriteSet)
	lookupSet := toSet(res.LookupSet)
	// Classify (and compute merges) first; touch the upper layer only once
	// every path succeeded, so a failure leaves the workspace unchanged.
	var apply []func() error
	genList, _, _ := m.blobAt(ctx, toIdx, merge.GeneratedListPath)
	isGenerated := merge.GeneratedMatcher(genList)
	for _, p := range delta {
		var n *Notice
		switch {
		case writeSet[p] && isGenerated(p):
			// Generated files are never text-merged: take main's version (the integrator
			// regenerates after merging the sources).
			content, present, berr := m.blobAt(ctx, toIdx, p)
			if berr != nil {
				return nil, berr
			}
			apply = append(apply, func() error { return u.ResetToLower(p, content, present) })
			method := "regenerate"
			n = &Notice{Path: p, Kind: KindWriteWrite, Severity: sigdiff.SeverityIgnore,
				Reason: "generated file: took main's version; it is regenerated on promotion", MergeResult: strp(MergeMerged), MergeMethod: &method}
		case writeSet[p]:
			var fix func() error
			n, fix, err = m.writeWrite(ctx, u, p, fromIdx, toIdx)
			if fix != nil {
				apply = append(apply, fix)
			}
		case readSet[p]:
			n, err = m.readWrite(ctx, p, fromIdx, toIdx)
		case lookupSet[p] && existenceChanged(fromIdx, toIdx, p):
			n = &Notice{Path: p, Kind: KindReadWrite, Severity: sigdiff.SeverityReview,
				Reason: "a file your tools resolved (but never read) was added or deleted on main"}
		default:
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("checkpoint %s: %w", p, err)
		}
		n.Diff = mirror.UnifiedDiff(ctx, from, toSha, p, maxNoticeDiff)
		res.Notices = append(res.Notices, *n)
	}

	for _, fix := range apply {
		if err := fix(); err != nil {
			return nil, fmt.Errorf("checkpoint: rewriting overlay: %w", err)
		}
	}
	mirror.HoldIndex(toSha)
	gen := w.mount.Advance(toIdx, delta)
	mirror.ReleaseIndex(from)
	_ = mirror.Pin(ctx, w.ID, toSha)
	w.pinSha = toSha
	res.Generation = gen
	for i := range res.Notices {
		res.Notices[i].Generation, res.Notices[i].FromSha, res.Notices[i].ToSha = gen, from, toSha
	}
	w.inbox.AppendNotices(res.Notices)
	return res, nil
}

func existenceChanged(from, to *gitstore.TreeIndex, p string) bool {
	a, okA := from.Lookup(p)
	b, okB := to.Lookup(p)
	return okA != okB || okA && a.Type != b.Type
}

func toSet(xs []string) map[string]bool {
	s := make(map[string]bool, len(xs))
	for _, x := range xs {
		s[x] = true
	}
	return s
}

// blobAt returns the content of p in idx (present=false if absent or not a
// regular file).
func (m *Manager) blobAt(ctx context.Context, idx *gitstore.TreeIndex, p string) ([]byte, bool, error) {
	e, ok := idx.Lookup(p)
	if !ok || e.Type != gitstore.TypeBlob {
		return nil, false, nil
	}
	b, err := m.cfg.Mirror.Blob(ctx, e.SHA)
	if err != nil {
		return nil, false, err
	}
	return b, true, nil
}

func (m *Manager) readWrite(ctx context.Context, p string, fromIdx, toIdx *gitstore.TreeIndex) (*Notice, error) {
	base, baseOK, err := m.blobAt(ctx, fromIdx, p)
	if err != nil {
		return nil, err
	}
	theirs, theirsOK, err := m.blobAt(ctx, toIdx, p)
	if err != nil {
		return nil, err
	}
	sd := m.cfg.Sigdiff.Diff(ctx, p, base, baseOK, theirs, theirsOK)
	return &Notice{Path: p, Kind: KindReadWrite, Severity: sd.Severity, Reason: sd.Reason}, nil
}

// writeWrite merges a path changed both in the overlay and on main. It
// returns the notice and (if the overlay must change) a deferred fix that
// rewrites the upper layer.
func (m *Manager) writeWrite(ctx context.Context, u *livefs.Union, p string, fromIdx, toIdx *gitstore.TreeIndex) (*Notice, func() error, error) {
	base, baseOK, err := m.blobAt(ctx, fromIdx, p)
	if err != nil {
		return nil, nil, err
	}
	theirs, theirsOK, err := m.blobAt(ctx, toIdx, p)
	if err != nil {
		return nil, nil, err
	}
	ours, inUpper, deleted, err := u.UpperState(p)
	if err != nil {
		return nil, nil, err
	}
	n := &Notice{Path: p, Kind: KindWriteWrite}
	merged := func(method *string, reason string) *Notice {
		sd := m.cfg.Sigdiff.Diff(ctx, p, base, baseOK, theirs, theirsOK)
		n.MergeResult, n.MergeMethod = strp(MergeMerged), method
		n.Severity = sd.Severity
		n.Reason = reason + "; upstream change: " + sd.Reason
		return n
	}
	conflict := func(reason string) *Notice {
		n.MergeResult, n.Severity, n.Reason = strp(MergeConflict), sigdiff.SeverityInterrupt, reason
		return n
	}
	takeTheirs := func() error { return u.ResetToLower(p, theirs, theirsOK) }

	switch {
	case inUpper && ours == nil:
		return conflict("overlay holds a non-regular file here; resolve manually"), nil, nil
	case !inUpper && deleted:
		if !theirsOK {
			return merged(nil, "deleted in overlay and on main"), nil, nil
		}
		return conflict("deleted in overlay, changed on main"), nil, nil
	case !inUpper:
		// In the write set only through a whiteout-expanded ancestor that has
		// since been recreated; treat as unchanged overlay.
		return merged(nil, "overlay does not hold this path"), nil, nil
	case !theirsOK:
		if baseOK && bytes.Equal(ours, base) {
			return merged(nil, "unchanged in overlay, deleted on main"), takeTheirs, nil
		}
		return conflict("modified in overlay, deleted on main (overlay version kept)"), nil, nil
	case bytes.Equal(ours, theirs):
		return merged(nil, "identical change on both sides"), takeTheirs, nil
	case baseOK && bytes.Equal(ours, base):
		return merged(nil, "unchanged in overlay, took main"), takeTheirs, nil
	}

	res, err := m.cfg.Merger.Merge(ctx, p, base, ours, theirs)
	if err != nil {
		return nil, nil, err
	}
	content := res.Content
	write := func() error { return u.WriteUpper(p, content) }
	if !res.Clean {
		return conflict("conflicting edits; conflict markers written to the file"), write, nil
	}
	if bytes.Equal(content, theirs) {
		write = takeTheirs
	}
	return merged(strp(res.Method), "merged via "+res.Method), write, nil
}

// OverlayResult is the GET /overlay response.
type OverlayResult struct {
	PinSha     string          `json:"pinSha"`
	Generation uint64          `json:"generation"`
	ReadSet    []string        `json:"readSet"`
	WriteSet   []string        `json:"writeSet"`
	LookupSet  []string        `json:"lookupSet"`
	ReaddirSet []string        `json:"readdirSet"`
	Changes    []livefs.Change `json:"changes"`
	// Classes: sigdiff class of each change relative to the pin (paths
	// omitted when sigdiff is unavailable).
	Classes map[string]string `json:"classes"`
}

// Overlay describes the workspace's pending changes and read set.
func (m *Manager) Overlay(ctx context.Context, w *Workspace) (*OverlayResult, error) {
	if err := w.requireLivefs(); err != nil {
		return nil, err
	}
	if err := w.readLock(); err != nil {
		return nil, err
	}
	defer w.apiMu.RUnlock()
	u := w.mount.U
	changes, err := u.Changes()
	if err != nil {
		return nil, err
	}
	classes := make(map[string]string, len(changes))
	if m.cfg.Sigdiff.Available() && len(changes) > 0 {
		pinIdx, err := m.cfg.Mirror.Index(ctx, w.pinSha)
		if err != nil {
			return nil, err
		}
		for _, c := range changes {
			old, oldOK, err := m.blobAt(ctx, pinIdx, c.Path)
			if err != nil {
				return nil, err
			}
			var cur []byte
			if c.Content != nil {
				cur = []byte(*c.Content)
			}
			if res, ok := m.cfg.Sigdiff.Classify(ctx, c.Path, old, oldOK, cur, c.Content != nil); ok {
				classes[c.Path] = res.Class
			}
		}
	}
	return &OverlayResult{
		PinSha:     w.pinSha,
		Generation: u.Generation(),
		ReadSet:    u.ReadSet(),
		WriteSet:   u.WriteSet(),
		LookupSet:  u.LookupSet(),
		ReaddirSet: u.ReaddirSet(),
		Changes:    changes,
		Classes:    classes,
	}, nil
}

// ResetReadSet clears the read sets (testing only).
func (m *Manager) ResetReadSet(w *Workspace) error {
	if err := w.requireLivefs(); err != nil {
		return err
	}
	if err := w.readLock(); err != nil {
		return err
	}
	defer w.apiMu.RUnlock()
	w.mount.U.ResetReadSet()
	return nil
}
