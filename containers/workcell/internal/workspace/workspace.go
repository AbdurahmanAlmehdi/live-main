// Package workspace manages agent workspaces (livefs mounts and plain git
// clones): file tools, test runs, checkpoints, overlays, inboxes, git ops.
package workspace

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"livemain/workcell/internal/apierr"
	"livemain/workcell/internal/gitstore"
	"livemain/workcell/internal/livefs"
	"livemain/workcell/internal/merge"
	"livemain/workcell/internal/sigdiff"
	"livemain/workcell/internal/testrun"
)

// Kinds of workspace.
const (
	KindLivefs = "livefs"
	KindClone  = "clone"
)

// Config holds shared dependencies.
type Config struct {
	DataDir string
	DepsDir string
	Mirror  *gitstore.Mirror
	Merger  *merge.Merger
	Sigdiff *sigdiff.Client
	Tests   *testrun.Runner
	Fuse    livefs.MountOptions
}

// Manager owns all workspaces of this process.
type Manager struct {
	cfg Config

	mu     sync.Mutex
	spaces map[string]*Workspace // nil value = creation in progress
}

// Workspace is one agent workspace.
type Workspace struct {
	ID     string
	Kind   string
	Path   string
	Remote string
	Branch string

	// apiMu: checkpoint and delete take it exclusively; every other call
	// (including whole test runs) holds it shared. That pins the generation
	// for the duration of a test run.
	apiMu sync.RWMutex
	// fsMu serializes mutating file tools and git ops.
	fsMu sync.Mutex

	mount      *livefs.Mount
	pinSha     string // livefs: lower commit (guarded by apiMu)
	cacheDir   string
	inbox      Inbox
	createdSha string
	deleted    bool
}

// Info is the public description of a workspace.
type Info struct {
	ID         string `json:"id"`
	Kind       string `json:"kind"`
	Path       string `json:"path"`
	Sha        string `json:"sha"`
	Generation uint64 `json:"generation"`
}

// NewManager creates a manager and clears leftovers of previous processes
// (workspaces are not persisted across restarts).
func NewManager(cfg Config) *Manager {
	m := &Manager{cfg: cfg, spaces: make(map[string]*Workspace)}
	m.cleanupStale()
	return m
}

func (m *Manager) dir(parts ...string) string {
	return filepath.Join(append([]string{m.cfg.DataDir}, parts...)...)
}

func (m *Manager) cleanupStale() {
	mnts, _ := os.ReadDir(m.dir("mnt"))
	for _, e := range mnts {
		p := m.dir("mnt", e.Name())
		_ = unmountStale(p)
		_ = os.Remove(p)
	}
	for _, sub := range []string{"upper", "clones", "cache"} {
		_ = os.RemoveAll(m.dir(sub))
	}
}

// Count returns the number of live workspaces.
func (m *Manager) Count() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	n := 0
	for _, w := range m.spaces {
		if w != nil {
			n++
		}
	}
	return n
}

// Get returns a workspace or a not-found error.
func (m *Manager) Get(id string) (*Workspace, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	w := m.spaces[id]
	if w == nil {
		return nil, apierr.NotFound("workspace %q not found", id)
	}
	return w, nil
}

// List returns all workspace infos.
func (m *Manager) List(ctx context.Context) []Info {
	m.mu.Lock()
	var ws []*Workspace
	for _, w := range m.spaces {
		if w != nil {
			ws = append(ws, w)
		}
	}
	m.mu.Unlock()
	out := make([]Info, 0, len(ws))
	for _, w := range ws {
		out = append(out, w.Info(ctx))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

// CreateRequest is the POST /workspaces body.
type CreateRequest struct {
	ID     string `json:"id"`
	Kind   string `json:"kind"`
	Remote string `json:"remote"`
	Sha    string `json:"sha"`
	Branch string `json:"branch"`
}

// Create creates and (for livefs) mounts a workspace.
func (m *Manager) Create(ctx context.Context, req CreateRequest) (*Workspace, error) {
	if err := ValidID(req.ID); err != nil {
		return nil, err
	}
	if req.Kind == "" {
		req.Kind = KindLivefs
	}
	if req.Kind != KindLivefs && req.Kind != KindClone {
		return nil, apierr.BadRequest("kind must be livefs or clone")
	}
	if req.Remote == "" {
		return nil, apierr.BadRequest("remote is required")
	}
	m.mu.Lock()
	if _, exists := m.spaces[req.ID]; exists {
		m.mu.Unlock()
		return nil, apierr.Conflict("exists", "workspace %q already exists", req.ID)
	}
	m.spaces[req.ID] = nil // reserve
	m.mu.Unlock()

	w, err := m.create(ctx, req)
	m.mu.Lock()
	if err != nil {
		delete(m.spaces, req.ID)
	} else {
		m.spaces[req.ID] = w
	}
	m.mu.Unlock()
	return w, err
}

func (m *Manager) resolveSha(ctx context.Context, remote, sha string) (string, error) {
	if sha == "" {
		head, err := m.cfg.Mirror.RemoteRef(ctx, remote, "refs/heads/main")
		if err != nil {
			return "", apierr.New(http.StatusBadGateway, "remote-error", "%v", err)
		}
		if head == "" {
			return "", apierr.BadRequest("sha omitted and remote has no main branch")
		}
		sha = head
	}
	if !gitstore.IsSHA(sha) {
		return "", apierr.BadRequest("sha must be a full commit id")
	}
	if err := m.cfg.Mirror.Fetch(ctx, remote, sha); err != nil {
		return "", apierr.New(http.StatusBadGateway, "fetch-failed", "%v", err)
	}
	return sha, nil
}

func (m *Manager) create(ctx context.Context, req CreateRequest) (*Workspace, error) {
	sha, err := m.resolveSha(ctx, req.Remote, req.Sha)
	if err != nil {
		return nil, err
	}
	w := &Workspace{
		ID:         req.ID,
		Kind:       req.Kind,
		Remote:     req.Remote,
		Branch:     req.Branch,
		cacheDir:   m.dir("cache", req.ID),
		createdSha: sha,
	}
	if req.Kind == KindClone {
		if err := m.createClone(ctx, w, sha); err != nil {
			_ = os.RemoveAll(w.Path)
			return nil, err
		}
		return w, nil
	}
	if err := m.createLivefs(ctx, w, sha); err != nil {
		return nil, err
	}
	return w, nil
}

func (m *Manager) createLivefs(ctx context.Context, w *Workspace, sha string) error {
	mirror := m.cfg.Mirror
	idx, err := mirror.Index(ctx, sha)
	if err != nil {
		return err
	}
	upper := m.dir("upper", w.ID)
	mnt := m.dir("mnt", w.ID)
	_ = unmountStale(mnt)
	if err := os.RemoveAll(upper); err != nil {
		return err
	}
	u, err := livefs.NewUnion(livefs.Config{
		UpperDir:   upper,
		DepsTarget: m.cfg.DepsDir,
		Inbox:      w.inbox.Render,
		Blobs:      mirror,
	}, idx)
	if err != nil {
		return err
	}
	mount, err := livefs.MountUnion(mnt, u, m.cfg.Fuse)
	if err != nil {
		_ = os.RemoveAll(upper)
		return apierr.New(http.StatusInternalServerError, "mount-failed", "%v", err)
	}
	mirror.HoldIndex(sha)
	if err := mirror.Pin(ctx, w.ID, sha); err != nil {
		log.Printf("workspace %s: pin: %v", w.ID, err)
	}
	w.mount, w.Path, w.pinSha = mount, mnt, sha
	return nil
}

func (m *Manager) createClone(ctx context.Context, w *Workspace, sha string) error {
	dir := m.dir("clones", w.ID)
	w.Path = dir
	if w.Branch == "" {
		w.Branch = "agent/" + w.ID
	}
	if err := os.RemoveAll(dir); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dir), 0o755); err != nil {
		return err
	}
	steps := [][]string{
		{"clone", "-q", "--no-checkout", "--reference", m.cfg.Mirror.Dir, w.Remote, dir},
		{"-C", dir, "checkout", "-q", "-b", w.Branch, sha},
		{"-C", dir, "config", "user.name", w.ID},
		{"-C", dir, "config", "user.email", w.ID + "@livemain"},
	}
	for _, args := range steps {
		if _, err := gitstore.Run(ctx, gitstore.Cmd{Args: args}); err != nil {
			return apierr.New(http.StatusBadGateway, "clone-failed", "%v", err)
		}
	}
	if err := os.Symlink(m.cfg.DepsDir, filepath.Join(dir, "node_modules")); err != nil {
		return err
	}
	f, err := os.OpenFile(filepath.Join(dir, ".git", "info", "exclude"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.WriteString("node_modules\n")
	return err
}

// Delete unmounts and removes a workspace (waiting for in-flight calls).
func (m *Manager) Delete(ctx context.Context, id string) error {
	m.mu.Lock()
	w := m.spaces[id]
	if w == nil {
		m.mu.Unlock()
		return apierr.NotFound("workspace %q not found", id)
	}
	delete(m.spaces, id)
	m.mu.Unlock()

	w.apiMu.Lock()
	defer w.apiMu.Unlock()
	w.deleted = true
	var errs []error
	if w.mount != nil {
		if err := w.mount.Unmount(); err != nil {
			errs = append(errs, err)
		}
		m.cfg.Mirror.Unpin(ctx, w.ID)
		m.cfg.Mirror.ReleaseIndex(w.pinSha)
		_ = os.Remove(w.Path)
		_ = os.RemoveAll(m.dir("upper", w.ID))
	} else {
		_ = os.RemoveAll(w.Path)
	}
	_ = os.RemoveAll(w.cacheDir)
	return errors.Join(errs...)
}

// Info describes the workspace.
func (w *Workspace) Info(ctx context.Context) Info {
	w.apiMu.RLock()
	defer w.apiMu.RUnlock()
	info := Info{ID: w.ID, Kind: w.Kind, Path: w.Path}
	if w.mount != nil {
		info.Sha, info.Generation = w.pinSha, w.mount.U.Generation()
	} else {
		info.Generation = 1
		info.Sha = w.createdSha
		if head, err := gitstore.Git(ctx, w.Path, "rev-parse", "HEAD"); err == nil {
			info.Sha = head
		}
	}
	return info
}

// readLock takes the shared API lock, failing if the workspace is gone.
func (w *Workspace) readLock() error {
	w.apiMu.RLock()
	if w.deleted {
		w.apiMu.RUnlock()
		return apierr.NotFound("workspace %q was deleted", w.ID)
	}
	return nil
}

func (w *Workspace) requireLivefs() error {
	if w.mount == nil {
		return apierr.BadRequest("workspace %q is a %s workspace; this operation needs livefs", w.ID, w.Kind)
	}
	return nil
}

func (w *Workspace) requireClone() error {
	if w.mount != nil {
		return apierr.BadRequest("workspace %q is a livefs workspace; git ops need a clone", w.ID)
	}
	return nil
}

// TestRequest is the POST /workspaces/:id/test body.
type TestRequest struct {
	Files     []string `json:"files"`
	TimeoutMs int64    `json:"timeoutMs"`
}

// Test runs vitest in the workspace with the generation pinned.
func (m *Manager) Test(ctx context.Context, w *Workspace, req TestRequest) (*testrun.Result, error) {
	files := make([]string, 0, len(req.Files))
	for _, f := range req.Files {
		p, err := CleanPath(f, false)
		if err != nil {
			return nil, err
		}
		files = append(files, p)
	}
	if err := w.readLock(); err != nil {
		return nil, err
	}
	defer w.apiMu.RUnlock()
	res, err := m.cfg.Tests.Run(ctx, w.Path, files, time.Duration(req.TimeoutMs)*time.Millisecond, w.cacheDir)
	if err != nil {
		return nil, fmt.Errorf("test run: %w", err)
	}
	return res, nil
}

// Inbox exposes the workspace inbox.
func (w *Workspace) Inbox() *Inbox { return &w.inbox }

// unmountStale detaches a leftover mount at dir, if any.
func unmountStale(dir string) error { return livefs.LazyUnmount(dir) }
