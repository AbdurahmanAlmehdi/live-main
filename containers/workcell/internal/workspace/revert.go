package workspace

import (
	"context"
	"os"
	"path/filepath"

	"livemain/workcell/internal/gitstore"
)

// Revert discards the workspace's changes to one file, like `git checkout -- path`:
// for livefs the overlay's version (upper copy or whiteout) is dropped so the pinned
// base shows through; for clones the file is restored from HEAD (or removed if HEAD
// does not have it).
func (m *Manager) Revert(ctx context.Context, w *Workspace, rawPath string) error {
	p, err := CleanPath(rawPath, false)
	if err != nil {
		return err
	}
	if err := w.checkWritable(p); err != nil {
		return err
	}
	if err := w.readLock(); err != nil {
		return err
	}
	defer w.apiMu.RUnlock()
	w.fsMu.Lock()
	defer w.fsMu.Unlock()

	if w.mount != nil {
		idx, err := m.cfg.Mirror.Index(ctx, w.pinSha)
		if err != nil {
			return err
		}
		content, present, err := m.blobAt(ctx, idx, p)
		if err != nil {
			return err
		}
		if err := w.mount.U.ResetToLower(p, content, present); err != nil {
			return fsError(p, err)
		}
		w.mount.Invalidate([]string{p})
		return nil
	}
	if _, err := gitstore.Run(ctx, gitstore.Cmd{Dir: w.Path, Args: []string{"cat-file", "-e", "HEAD:" + p}}); err != nil {
		if rmErr := os.Remove(filepath.Join(w.Path, filepath.FromSlash(p))); rmErr != nil && !os.IsNotExist(rmErr) {
			return fsError(p, rmErr)
		}
		return nil
	}
	_, err = gitstore.Run(ctx, gitstore.Cmd{Dir: w.Path, Args: []string{"checkout", "HEAD", "--", p}})
	return err
}
