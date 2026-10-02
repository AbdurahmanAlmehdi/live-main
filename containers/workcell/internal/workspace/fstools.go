package workspace

import (
	"bytes"
	"errors"
	"io/fs"
	"path"
	"regexp"
	"sort"
	"strings"
	"syscall"

	"livemain/workcell/internal/apierr"
	"livemain/workcell/internal/merge"
)

// All file tools go through w.fs(): the union (in process, recording reads
// like the FUSE mount does) for livefs workspaces, the OS for clones.

func fsError(p string, err error) error {
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return apierr.NotFound("%s: no such file or directory", p)
	case errors.Is(err, syscall.EISDIR):
		return apierr.New(400, "is-directory", "%s: is a directory", p)
	case errors.Is(err, syscall.ENOTDIR):
		return apierr.BadRequest("%s: not a directory", p)
	case errors.Is(err, syscall.EPERM), errors.Is(err, syscall.EACCES), errors.Is(err, syscall.EROFS):
		return apierr.New(403, "forbidden", "%s: %v", p, err)
	}
	return err
}

// ReadRequest is the fs/read body.
type ReadRequest struct {
	Path   string `json:"path"`
	Offset int    `json:"offset"`
	Limit  int    `json:"limit"`
}

// ReadResult is the fs/read response.
type ReadResult struct {
	Content    string `json:"content"`
	TotalLines int    `json:"totalLines"`
}

// Read returns (a line window of) a file.
func (w *Workspace) Read(req ReadRequest) (*ReadResult, error) {
	p, err := CleanPath(req.Path, false)
	if err != nil {
		return nil, err
	}
	if err := w.readLock(); err != nil {
		return nil, err
	}
	defer w.apiMu.RUnlock()
	b := w.fs()
	exists, isDir, err := b.stat(p)
	if err != nil {
		return nil, fsError(p, err)
	}
	if !exists {
		return nil, fsError(p, fs.ErrNotExist)
	}
	if isDir {
		return nil, apierr.New(400, "is-directory", "%s is a directory", p)
	}
	data, err := b.readFile(p)
	if err != nil {
		return nil, fsError(p, err)
	}
	lines := merge.SplitLines(data)
	res := &ReadResult{TotalLines: len(lines)}
	if req.Offset <= 1 && req.Limit <= 0 {
		res.Content = string(data)
		return res, nil
	}
	start := max(req.Offset, 1) - 1
	if start > len(lines) {
		start = len(lines)
	}
	end := len(lines)
	if req.Limit > 0 && start+req.Limit < end {
		end = start + req.Limit
	}
	res.Content = strings.Join(lines[start:end], "")
	return res, nil
}

// WriteRequest is the fs/write body.
type WriteRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

func (w *Workspace) checkWritable(p string) error {
	if reservedWrite(p) {
		return apierr.New(400, "reserved-path", "%s is reserved", p)
	}
	return nil
}

// Write creates or replaces a file (creating parent directories).
func (w *Workspace) Write(req WriteRequest) error {
	p, err := CleanPath(req.Path, false)
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
	return w.writeLocked(p, []byte(req.Content))
}

func (w *Workspace) writeLocked(p string, content []byte) error {
	if err := w.fs().writeFile(p, content); err != nil {
		return fsError(p, err)
	}
	return nil
}

// EditRequest is the fs/edit body.
type EditRequest struct {
	Path       string `json:"path"`
	OldString  string `json:"oldString"`
	NewString  string `json:"newString"`
	ReplaceAll bool   `json:"replaceAll"`
}

// Edit replaces oldString with newString; returns the replacement count.
func (w *Workspace) Edit(req EditRequest) (int, error) {
	p, err := CleanPath(req.Path, false)
	if err != nil {
		return 0, err
	}
	if err := w.checkWritable(p); err != nil {
		return 0, err
	}
	if req.OldString == "" {
		return 0, apierr.BadRequest("oldString must not be empty")
	}
	if err := w.readLock(); err != nil {
		return 0, err
	}
	defer w.apiMu.RUnlock()
	w.fsMu.Lock()
	defer w.fsMu.Unlock()
	data, err := w.fs().readFile(p)
	if err != nil {
		return 0, fsError(p, err)
	}
	n := bytes.Count(data, []byte(req.OldString))
	switch {
	case n == 0:
		return 0, apierr.Conflict("no-match", "oldString not found in %s", p)
	case n > 1 && !req.ReplaceAll:
		return 0, apierr.Conflict("ambiguous", "oldString occurs %d times in %s; pass replaceAll or add context", n, p).With("count", n)
	}
	limit := 1
	if req.ReplaceAll {
		limit = -1
	}
	out := bytes.Replace(data, []byte(req.OldString), []byte(req.NewString), limit)
	if err := w.writeLocked(p, out); err != nil {
		return 0, err
	}
	if !req.ReplaceAll {
		n = 1
	}
	return n, nil
}

// Delete removes a file or directory tree.
func (w *Workspace) Delete(rawPath string) error {
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
	b := w.fs()
	if exists, _, err := b.stat(p); err != nil || !exists {
		if err == nil {
			err = fs.ErrNotExist
		}
		return fsError(p, err)
	}
	if err := b.removeAll(p); err != nil {
		return fsError(p, err)
	}
	return nil
}

// ListEntry is one fs/list result.
type ListEntry struct {
	Path string `json:"path"`
	Type string `json:"type"`
}

// List lists a directory (optionally recursively).
func (w *Workspace) List(rawPath string, recursive bool) ([]ListEntry, error) {
	p, err := CleanPath(rawPath, true)
	if err != nil {
		return nil, err
	}
	if err := w.readLock(); err != nil {
		return nil, err
	}
	defer w.apiMu.RUnlock()
	b := w.fs()
	exists, isDir, err := b.stat(p)
	if err != nil || !exists {
		if err == nil {
			err = fs.ErrNotExist
		}
		return nil, fsError(p, err)
	}
	if !isDir {
		return nil, apierr.BadRequest("%s is not a directory", p)
	}
	entries := []ListEntry{}
	var walk func(dir string) error
	walk = func(dir string) error {
		des, err := b.readDir(dir)
		if err != nil {
			return fsError(dir, err)
		}
		for _, de := range des {
			if excludedName(de.name) {
				continue
			}
			rel := joinRel(dir, de.name)
			typ := "file"
			if de.isDir {
				typ = "dir"
			}
			entries = append(entries, ListEntry{Path: rel, Type: typ})
			if recursive && de.isDir {
				if err := walk(rel); err != nil {
					return err
				}
			}
		}
		return nil
	}
	if err := walk(p); err != nil {
		return nil, err
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Path < entries[j].Path })
	return entries, nil
}

func joinRel(dir, name string) string {
	if dir == "" {
		return name
	}
	return dir + "/" + name
}

// GrepRequest is the fs/grep body.
type GrepRequest struct {
	Pattern    string `json:"pattern"`
	Path       string `json:"path"`
	Glob       string `json:"glob"`
	MaxResults int    `json:"maxResults"`
}

// GrepMatch is one matching line.
type GrepMatch struct {
	Path string `json:"path"`
	Line int    `json:"line"`
	Text string `json:"text"`
}

const maxGrepFileSize = 4 << 20

// Grep searches file contents with an RE2 pattern.
func (w *Workspace) Grep(req GrepRequest) ([]GrepMatch, bool, error) {
	re, err := regexp.Compile(req.Pattern)
	if err != nil {
		return nil, false, apierr.BadRequest("invalid pattern: %v", err)
	}
	root, err := CleanPath(req.Path, true)
	if err != nil {
		return nil, false, err
	}
	matchGlob, err := compileGlob(req.Glob)
	if err != nil {
		return nil, false, err
	}
	limit := req.MaxResults
	if limit <= 0 {
		limit = 200
	}
	if err := w.readLock(); err != nil {
		return nil, false, err
	}
	defer w.apiMu.RUnlock()
	be := w.fs()
	if exists, _, err := be.stat(root); err != nil || !exists {
		if err == nil {
			err = fs.ErrNotExist
		}
		return nil, false, fsError(root, err)
	}
	matches := []GrepMatch{}
	truncated := false
	errStop := errors.New("stop")
	var walk func(dir string) error
	walk = func(dir string) error {
		exists, isDir, _ := be.stat(dir)
		if !exists {
			return nil
		}
		if !isDir {
			return grepFile(be, dir, re, matchGlob, limit, &matches, &truncated, errStop)
		}
		des, err := be.readDir(dir)
		if err != nil {
			return nil
		}
		for _, de := range des {
			if excludedName(de.name) {
				continue
			}
			rel := joinRel(dir, de.name)
			if de.isDir {
				if err := walk(rel); err != nil {
					return err
				}
				continue
			}
			if !de.regular {
				continue
			}
			if err := grepFile(be, rel, re, matchGlob, limit, &matches, &truncated, errStop); err != nil {
				return err
			}
		}
		return nil
	}
	walkErr := walk(root)
	if walkErr != nil && walkErr != errStop {
		return nil, false, walkErr
	}
	return matches, truncated, nil
}

func grepFile(be fsBackend, rel string, re *regexp.Regexp, matchGlob func(string) bool, limit int, matches *[]GrepMatch, truncated *bool, errStop error) error {
	if !matchGlob(rel) {
		return nil
	}
	data, err := be.readFile(rel)
	if err != nil || len(data) > maxGrepFileSize || bytes.IndexByte(data[:min(len(data), 8000)], 0) >= 0 {
		return nil
	}
	for i, line := range merge.SplitLines(data) {
		line = strings.TrimRight(line, "\r\n")
		if re.MatchString(line) {
			if len(*matches) >= limit {
				*truncated = true
				return errStop
			}
			*matches = append(*matches, GrepMatch{Path: rel, Line: i + 1, Text: truncateLine(line)})
		}
	}
	return nil
}

func truncateLine(s string) string {
	if len(s) > 500 {
		return s[:500] + "..."
	}
	return s
}

// compileGlob returns a matcher for a glob like "*.ts", "*.{ts,tsx}" or
// "src/**/*.ts". Patterns without "/" match the base name.
func compileGlob(glob string) (func(string) bool, error) {
	if glob == "" {
		return func(string) bool { return true }, nil
	}
	var res []*regexp.Regexp
	for _, g := range expandBraces(glob) {
		re, err := globToRegexp(g)
		if err != nil {
			return nil, apierr.BadRequest("invalid glob %q", glob)
		}
		res = append(res, re)
	}
	baseOnly := !strings.Contains(glob, "/")
	return func(rel string) bool {
		target := rel
		if baseOnly {
			target = path.Base(rel)
		}
		for _, re := range res {
			if re.MatchString(target) {
				return true
			}
		}
		return false
	}, nil
}

func expandBraces(g string) []string {
	i := strings.IndexByte(g, '{')
	if i < 0 {
		return []string{g}
	}
	j := strings.IndexByte(g[i:], '}')
	if j < 0 {
		return []string{g}
	}
	var out []string
	for _, alt := range strings.Split(g[i+1:i+j], ",") {
		out = append(out, expandBraces(g[:i]+alt+g[i+j+1:])...)
	}
	return out
}

func globToRegexp(g string) (*regexp.Regexp, error) {
	var b strings.Builder
	b.WriteString("^")
	for i := 0; i < len(g); i++ {
		c := g[i]
		switch {
		case c == '*' && i+1 < len(g) && g[i+1] == '*':
			i++
			if i+1 < len(g) && g[i+1] == '/' {
				i++
				b.WriteString("(?:.*/)?")
			} else {
				b.WriteString(".*")
			}
		case c == '*':
			b.WriteString("[^/]*")
		case c == '?':
			b.WriteString("[^/]")
		default:
			b.WriteString(regexp.QuoteMeta(string(c)))
		}
	}
	b.WriteString("$")
	return regexp.Compile(b.String())
}
