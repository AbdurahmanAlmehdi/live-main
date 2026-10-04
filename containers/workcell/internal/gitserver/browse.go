package gitserver

import (
	"context"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"livemain/workcell/internal/apierr"
	"livemain/workcell/internal/gitstore"
)

// Read-only browsing (tree, log, diff) and URL import, for the web app's code and
// history views. Refs are commit shas or branch names; nothing here writes except import.

var refRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$`)

func validRef(ref string) error {
	if !refRe.MatchString(ref) || strings.Contains(ref, "..") {
		return apierr.BadRequest("invalid ref %q", ref)
	}
	return nil
}

func validPath(p string) error {
	if strings.HasPrefix(p, "/") || strings.HasPrefix(p, "-") || strings.Contains(p, "..") {
		return apierr.BadRequest("invalid path %q", p)
	}
	return nil
}

// repoRoute validates the repo name and existence before calling h with the repo dir.
func (s *Server) repoRoute(h func(w http.ResponseWriter, r *http.Request, dir string) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		if err := validName(name); err != nil {
			apierr.Write(w, err)
			return
		}
		if !s.exists(name) {
			apierr.Write(w, apierr.NotFound("repo %q not found", name))
			return
		}
		if err := h(w, r, s.repoDir(name)); err != nil {
			apierr.Write(w, err)
		}
	}
}

type treeEntry struct {
	Path string `json:"path"`
	Type string `json:"type"` // file | dir
	Size *int64 `json:"size"`
}

// tree: GET /repos/{name}/tree?ref=<sha|branch> → every file and directory at ref.
func (s *Server) tree(w http.ResponseWriter, r *http.Request, dir string) error {
	ref := r.URL.Query().Get("ref")
	if err := validRef(ref); err != nil {
		return err
	}
	out, err := gitstore.Git(r.Context(), dir, "ls-tree", "-r", "-t", "-l", "--full-tree", "-z", ref)
	if err != nil {
		return apierr.NotFound("ref %s not found", ref)
	}
	entries := []treeEntry{}
	for _, rec := range strings.Split(out, "\x00") {
		meta, path, ok := strings.Cut(rec, "\t")
		if !ok {
			continue
		}
		f := strings.Fields(meta) // mode type object size
		if len(f) < 4 {
			continue
		}
		e := treeEntry{Path: path, Type: "file"}
		switch f[1] {
		case "tree":
			e.Type = "dir"
		case "blob":
			if n, err := strconv.ParseInt(f[3], 10, 64); err == nil {
				e.Size = &n
			}
		default:
			continue // submodules
		}
		entries = append(entries, e)
	}
	apierr.WriteJSON(w, http.StatusOK, map[string]any{"ref": ref, "entries": entries})
	return nil
}

type commit struct {
	Sha     string   `json:"sha"`
	Parents []string `json:"parents"`
	Author  string   `json:"author"`
	Email   string   `json:"email"`
	At      int64    `json:"at"`
	Subject string   `json:"subject"`
}

// log: GET /repos/{name}/log?ref=<ref>&path=<p>&max=<n> → newest first.
func (s *Server) log(w http.ResponseWriter, r *http.Request, dir string) error {
	q := r.URL.Query()
	ref := q.Get("ref")
	if ref == "" {
		ref = "main"
	}
	if err := validRef(ref); err != nil {
		return err
	}
	max := 100
	if n, err := strconv.Atoi(q.Get("max")); err == nil && n > 0 && n <= 1000 {
		max = n
	}
	args := []string{"log", "--format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s%x1e", "-n", strconv.Itoa(max), ref}
	if p := q.Get("path"); p != "" {
		if err := validPath(p); err != nil {
			return err
		}
		args = append(args, "--", p)
	}
	out, err := gitstore.Git(r.Context(), dir, args...)
	if err != nil {
		return apierr.NotFound("ref %s not found", ref)
	}
	commits := []commit{}
	for _, rec := range strings.Split(out, "\x1e") {
		f := strings.Split(strings.TrimSpace(rec), "\x1f")
		if len(f) != 6 {
			continue
		}
		at, _ := strconv.ParseInt(f[4], 10, 64)
		commits = append(commits, commit{Sha: f[0], Parents: strings.Fields(f[1]), Author: f[2], Email: f[3], At: at * 1000, Subject: f[5]})
	}
	apierr.WriteJSON(w, http.StatusOK, map[string]any{"commits": commits})
	return nil
}

// diff: GET /repos/{name}/diff?to=<sha>[&from=<sha>][&path=<p>] → unified patch (from defaults to to's first parent).
func (s *Server) diff(w http.ResponseWriter, r *http.Request, dir string) error {
	q := r.URL.Query()
	to, from := q.Get("to"), q.Get("from")
	if err := validRef(to); err != nil {
		return err
	}
	if from == "" {
		from = to + "^"
		if _, err := gitstore.Git(r.Context(), dir, "rev-parse", "--verify", "-q", from); err != nil {
			from = "4b825dc642cb6eb9a060e54bf8d69288fbee4904" // the empty tree: a root commit diffs against nothing
		}
	} else if err := validRef(from); err != nil {
		return err
	}
	args := []string{"diff", "--no-color", "--no-ext-diff", "-U3", "--find-renames", from, to}
	if p := q.Get("path"); p != "" {
		if err := validPath(p); err != nil {
			return err
		}
		args = append(args, "--", p)
	}
	patch, err := gitstore.Git(r.Context(), dir, args...)
	if err != nil {
		return apierr.NotFound("cannot diff %s..%s", from, to)
	}
	apierr.WriteJSON(w, http.StatusOK, map[string]string{"from": from, "to": to, "patch": patch})
	return nil
}

// importURL: POST /repos/{name}/import {"url"} fetches the URL's default branch into main
// (only into an empty repo, so it can never rewrite history).
func (s *Server) importURL(w http.ResponseWriter, r *http.Request, dir string) error {
	var body struct {
		URL string `json:"url"`
	}
	if !apierr.Decode(w, r, &body) {
		return nil
	}
	u, err := url.Parse(body.URL)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
		return apierr.BadRequest("url must be an http(s) git URL")
	}
	if _, err := gitstore.Git(r.Context(), dir, "rev-parse", "--verify", "-q", "refs/heads/main"); err == nil {
		return apierr.Conflict("not-empty", "repo already has a main branch")
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Minute)
	defer cancel()
	if _, err := gitstore.Git(ctx, dir, "fetch", "--no-tags", "-q", body.URL, "HEAD"); err != nil {
		return apierr.BadRequest("fetch %s failed: %v", body.URL, err)
	}
	sha, err := gitstore.Git(ctx, dir, "rev-parse", "FETCH_HEAD")
	if err != nil {
		return err
	}
	if _, err := gitstore.Git(ctx, dir, "update-ref", "refs/heads/main", sha); err != nil {
		return err
	}
	apierr.WriteJSON(w, http.StatusOK, map[string]string{"sha": sha})
	return nil
}

// initialCommit: POST /repos/{name}/init {"files": {path: content}, "message"} makes the
// first commit of an empty repo (new repositories created from scratch).
func (s *Server) initialCommit(w http.ResponseWriter, r *http.Request, dir string) error {
	var body struct {
		Files   map[string]string `json:"files"`
		Message string            `json:"message"`
	}
	if !apierr.Decode(w, r, &body) {
		return nil
	}
	if len(body.Files) == 0 {
		return apierr.BadRequest("files are required")
	}
	if body.Message == "" {
		body.Message = "Initial commit"
	}
	ctx := r.Context()
	if _, err := gitstore.Git(ctx, dir, "rev-parse", "--verify", "-q", "refs/heads/main"); err == nil {
		return apierr.Conflict("not-empty", "repo already has a main branch")
	}
	work, err := os.MkdirTemp("", "livemain-init-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(work)
	if _, err := gitstore.Git(ctx, work, "init", "-q", "-b", "main"); err != nil {
		return err
	}
	for p, content := range body.Files {
		if err := validPath(p); err != nil || p == "" || strings.HasPrefix(p, ".git/") || p == ".git" {
			return apierr.BadRequest("invalid path %q", p)
		}
		full := filepath.Join(work, filepath.FromSlash(p))
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
			return err
		}
	}
	for _, args := range [][]string{
		{"add", "-A"},
		{"-c", "user.name=Live Main", "-c", "user.email=livemain@localhost", "commit", "-q", "-m", body.Message},
		{"push", "-q", dir, "main:refs/heads/main"},
	} {
		if _, err := gitstore.Git(ctx, work, args...); err != nil {
			return err
		}
	}
	sha, err := gitstore.Git(ctx, work, "rev-parse", "HEAD")
	if err != nil {
		return err
	}
	apierr.WriteJSON(w, http.StatusOK, map[string]string{"sha": sha})
	return nil
}
