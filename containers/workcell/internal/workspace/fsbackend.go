package workspace

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"sort"
	"syscall"

	"livemain/workcell/internal/livefs"
)

// fsBackend is how the file tools reach a workspace tree.
//
// Clone workspaces use the OS. Livefs workspaces call the union in process
// instead of issuing syscalls against their own FUSE mount: a FUSE server that
// reads its own mount can deadlock (reliably so under CPU emulation, e.g. an
// amd64 image on an arm64 host), and the union records reads exactly as the
// FUSE handlers do, so read sets are unchanged. External processes (vitest,
// tsc) still go through the kernel mount.
type fsBackend interface {
	// stat reports whether p exists and is a directory.
	stat(p string) (exists, isDir bool, err error)
	readFile(p string) ([]byte, error)
	// writeFile creates or replaces p, creating parent directories.
	writeFile(p string, data []byte) error
	removeAll(p string) error
	readDir(p string) ([]dirEntry, error)
}

type dirEntry struct {
	name  string
	isDir bool
	// regular is false for symlinks and other non-regular entries.
	regular bool
}

func (w *Workspace) fs() fsBackend {
	if w.mount != nil {
		return &unionBackend{m: w.mount}
	}
	return osBackend{root: w.Path}
}

// ---- OS (clone workspaces) ----

type osBackend struct{ root string }

func (b osBackend) abs(p string) string {
	if p == "" {
		return b.root
	}
	return filepath.Join(b.root, filepath.FromSlash(p))
}

func (b osBackend) stat(p string) (bool, bool, error) {
	fi, err := os.Stat(b.abs(p))
	if errors.Is(err, fs.ErrNotExist) {
		return false, false, nil
	}
	if err != nil {
		return false, false, err
	}
	return true, fi.IsDir(), nil
}

func (b osBackend) readFile(p string) ([]byte, error) { return os.ReadFile(b.abs(p)) }

func (b osBackend) writeFile(p string, data []byte) error {
	if dir := path.Dir(p); dir != "." {
		if err := os.MkdirAll(b.abs(dir), 0o755); err != nil {
			return err
		}
	}
	return os.WriteFile(b.abs(p), data, 0o644)
}

func (b osBackend) removeAll(p string) error { return os.RemoveAll(b.abs(p)) }

func (b osBackend) readDir(p string) ([]dirEntry, error) {
	des, err := os.ReadDir(b.abs(p))
	if err != nil {
		return nil, err
	}
	out := make([]dirEntry, 0, len(des))
	for _, de := range des {
		out = append(out, dirEntry{name: de.Name(), isDir: de.IsDir(), regular: de.Type().IsRegular()})
	}
	return out, nil
}

// ---- union (livefs workspaces) ----

type unionBackend struct{ m *livefs.Mount }

func errnoErr(errno syscall.Errno) error {
	if errno == 0 {
		return nil
	}
	if errno == syscall.ENOENT {
		return fs.ErrNotExist
	}
	return errno
}

func (b *unionBackend) stat(p string) (bool, bool, error) {
	st, errno := b.m.U.Stat(p)
	if errno == syscall.ENOENT {
		return false, false, nil
	}
	if errno != 0 {
		return false, false, errno
	}
	return true, st.Type == livefs.TypeDir, nil
}

func (b *unionBackend) readFile(p string) ([]byte, error) {
	src, errno := b.m.U.OpenRead(context.Background(), p)
	if errno != 0 {
		return nil, errnoErr(errno)
	}
	if src.UpperPath != "" {
		return os.ReadFile(src.UpperPath)
	}
	return src.Data, nil
}

func (b *unionBackend) writeFile(p string, data []byte) error {
	touched, err := b.mkdirAll(path.Dir(p))
	if err != nil {
		return err
	}
	fd, errno := b.m.U.OpenWrite(context.Background(), p, syscall.O_WRONLY|syscall.O_TRUNC)
	if errno == syscall.ENOENT {
		fd, _, errno = b.m.U.Create(p, 0o644, syscall.O_WRONLY|syscall.O_TRUNC)
	}
	if errno != 0 {
		return errnoErr(errno)
	}
	f := os.NewFile(uintptr(fd), p)
	_, werr := f.Write(data)
	cerr := f.Close()
	b.m.Invalidate(append(touched, p))
	if werr != nil {
		return werr
	}
	return cerr
}

// mkdirAll creates missing parent directories through the union; returns the created paths.
func (b *unionBackend) mkdirAll(dir string) ([]string, error) {
	if dir == "." || dir == "" {
		return nil, nil
	}
	exists, isDir, err := b.stat(dir)
	if err != nil {
		return nil, err
	}
	if exists {
		if !isDir {
			return nil, syscall.ENOTDIR
		}
		return nil, nil
	}
	created, err := b.mkdirAll(path.Dir(dir))
	if err != nil {
		return nil, err
	}
	if _, errno := b.m.U.Mkdir(dir, 0o755); errno != 0 && errno != syscall.EEXIST {
		return nil, errnoErr(errno)
	}
	return append(created, dir), nil
}

func (b *unionBackend) removeAll(p string) error {
	removed, err := b.remove(p)
	b.m.Invalidate(removed)
	return err
}

func (b *unionBackend) remove(p string) ([]string, error) {
	st, errno := b.m.U.Stat(p)
	if errno == syscall.ENOENT {
		return nil, nil
	}
	if errno != 0 {
		return nil, errno
	}
	var removed []string
	if st.Type == livefs.TypeDir {
		children, err := b.readDir(p)
		if err != nil {
			return nil, err
		}
		for _, c := range children {
			r, err := b.remove(joinRel(p, c.name))
			removed = append(removed, r...)
			if err != nil {
				return removed, err
			}
		}
		if errno := b.m.U.Rmdir(p); errno != 0 {
			return removed, errnoErr(errno)
		}
	} else if errno := b.m.U.Unlink(p); errno != 0 {
		return removed, errnoErr(errno)
	}
	return append(removed, p), nil
}

func (b *unionBackend) readDir(p string) ([]dirEntry, error) {
	des, errno := b.m.U.ReadDir(p)
	if errno != 0 {
		return nil, errnoErr(errno)
	}
	out := make([]dirEntry, 0, len(des))
	for _, de := range des {
		out = append(out, dirEntry{name: de.Name, isDir: de.Type == livefs.TypeDir, regular: de.Type == livefs.TypeFile})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].name < out[j].name })
	return out, nil
}
