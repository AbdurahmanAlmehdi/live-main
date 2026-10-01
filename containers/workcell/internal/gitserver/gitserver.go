// Package gitserver is the local stand-in for Cloudflare Artifacts: bare
// repos served over git smart HTTP (git http-backend) plus a tiny control
// plane (create, fork, read ref, read file).
package gitserver

import (
	"context"
	"net/http"
	"net/http/cgi"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"livemain/workcell/internal/apierr"
	"livemain/workcell/internal/gitstore"
)

// Server serves repos under Root.
type Server struct {
	Root      string
	PublicURL string

	mu      sync.Mutex // serializes repo creation
	backend *cgi.Handler
}

// New creates a server.
func New(root, publicURL string) (*Server, error) {
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, err
	}
	gitPath, err := exec.LookPath("git")
	if err != nil {
		return nil, err
	}
	s := &Server{Root: root, PublicURL: strings.TrimRight(publicURL, "/")}
	s.backend = &cgi.Handler{
		Path: gitPath,
		Args: []string{"http-backend"},
		Root: "/",
		Env: append([]string{
			"GIT_PROJECT_ROOT=" + root,
			"GIT_HTTP_EXPORT_ALL=1",
			"GIT_HTTP_MAX_REQUEST_BUFFER=1000M",
		}, gitstoreEnv()...),
		InheritEnv: []string{"PATH", "HOME"},
	}
	return s, nil
}

func gitstoreEnv() []string {
	var out []string
	for _, kv := range gitstore.Env() {
		if strings.HasPrefix(kv, "GIT_") {
			out = append(out, kv)
		}
	}
	return out
}

var nameRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)

func validName(name string) error {
	if !nameRe.MatchString(name) || strings.HasSuffix(name, ".git") {
		return apierr.BadRequest("invalid repo name %q", name)
	}
	return nil
}

func (s *Server) repoDir(name string) string { return filepath.Join(s.Root, name+".git") }

func (s *Server) remote(name string) string { return s.PublicURL + "/" + name + ".git" }

func (s *Server) exists(name string) bool {
	_, err := os.Stat(filepath.Join(s.repoDir(name), "HEAD"))
	return err == nil
}

func configure(ctx context.Context, dir string) error {
	for _, kv := range [][2]string{
		{"receive.denyNonFastForwards", "true"},
		{"http.receivepack", "true"},
		{"uploadpack.allowAnySHA1InWant", "true"},
		{"uploadpack.allowReachableSHA1InWant", "true"},
		{"gc.auto", "0"},
	} {
		if _, err := gitstore.Git(ctx, dir, "config", kv[0], kv[1]); err != nil {
			return err
		}
	}
	// Refs are never deleted, except the git gateway's temporary refs/heads/push/*.
	hook := "#!/bin/sh\ncase \"$1\" in refs/heads/push/*) exit 0 ;; esac\n" +
		"if [ \"$3\" = \"0000000000000000000000000000000000000000\" ]; then echo \"deletion prohibited\" >&2; exit 1; fi\n"
	if err := os.MkdirAll(filepath.Join(dir, "hooks"), 0o755); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "hooks", "update"), []byte(hook), 0o755)
}

// Create makes a bare repo (idempotent).
func (s *Server) Create(ctx context.Context, name string) error {
	if err := validName(name); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	dir := s.repoDir(name)
	if !s.exists(name) {
		if _, err := gitstore.Git(ctx, "", "init", "--bare", "-q", "-b", "main", dir); err != nil {
			return err
		}
	}
	return configure(ctx, dir)
}

// Fork clones src into a new bare repo sharing objects.
func (s *Server) Fork(ctx context.Context, src, name string) error {
	if err := validName(src); err != nil {
		return err
	}
	if err := validName(name); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.exists(src) {
		return apierr.NotFound("repo %q not found", src)
	}
	if s.exists(name) {
		return apierr.Conflict("exists", "repo %q already exists", name)
	}
	if _, err := gitstore.Git(ctx, "", "clone", "--bare", "--shared", "-q", s.repoDir(src), s.repoDir(name)); err != nil {
		return err
	}
	return configure(ctx, s.repoDir(name))
}

// Handler returns the HTTP handler.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		apierr.WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "role": "gitserver"})
	})
	mux.HandleFunc("POST /repos", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name string `json:"name"`
		}
		if !apierr.Decode(w, r, &body) {
			return
		}
		if err := s.Create(r.Context(), body.Name); err != nil {
			apierr.Write(w, err)
			return
		}
		apierr.WriteJSON(w, http.StatusOK, map[string]string{"name": body.Name, "remote": s.remote(body.Name)})
	})
	mux.HandleFunc("POST /repos/{name}/fork", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name string `json:"name"`
		}
		if !apierr.Decode(w, r, &body) {
			return
		}
		if err := s.Fork(r.Context(), r.PathValue("name"), body.Name); err != nil {
			apierr.Write(w, err)
			return
		}
		apierr.WriteJSON(w, http.StatusOK, map[string]string{"name": body.Name, "remote": s.remote(body.Name)})
	})
	mux.HandleFunc("GET /repos/{name}/refs/heads/{branch...}", func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		if err := validName(name); err != nil {
			apierr.Write(w, err)
			return
		}
		if !s.exists(name) {
			apierr.Write(w, apierr.NotFound("repo %q not found", name))
			return
		}
		ref := "refs/heads/" + r.PathValue("branch")
		sha, err := gitstore.Git(r.Context(), s.repoDir(name), "rev-parse", "--verify", "-q", ref)
		if err != nil || sha == "" {
			apierr.Write(w, apierr.NotFound("%s not found in %s", ref, name))
			return
		}
		apierr.WriteJSON(w, http.StatusOK, map[string]string{"sha": sha})
	})
	mux.HandleFunc("GET /repos/{name}/file", func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		if err := validName(name); err != nil {
			apierr.Write(w, err)
			return
		}
		ref, p := r.URL.Query().Get("ref"), strings.TrimPrefix(r.URL.Query().Get("path"), "/")
		if ref == "" || p == "" || strings.Contains(p, "..") || strings.HasPrefix(ref, "-") {
			apierr.Write(w, apierr.BadRequest("ref and path are required"))
			return
		}
		if !s.exists(name) {
			apierr.Write(w, apierr.NotFound("repo %q not found", name))
			return
		}
		out, err := gitstore.Run(r.Context(), gitstore.Cmd{Dir: s.repoDir(name), Args: []string{"cat-file", "blob", ref + ":" + p}})
		if err != nil {
			apierr.Write(w, apierr.NotFound("%s not found at %s", p, ref))
			return
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		_, _ = w.Write(out)
	})
	mux.HandleFunc("GET /repos/{name}/tree", s.repoRoute(s.tree))
	mux.HandleFunc("GET /repos/{name}/log", s.repoRoute(s.log))
	mux.HandleFunc("GET /repos/{name}/diff", s.repoRoute(s.diff))
	mux.HandleFunc("POST /repos/{name}/import", s.repoRoute(s.importURL))
	mux.HandleFunc("POST /repos/{name}/init", s.repoRoute(s.initialCommit))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		first, _, _ := strings.Cut(strings.TrimPrefix(r.URL.Path, "/"), "/")
		if !strings.HasSuffix(first, ".git") || validName(strings.TrimSuffix(first, ".git")) != nil {
			apierr.Write(w, apierr.NotFound("no such endpoint"))
			return
		}
		if !s.exists(strings.TrimSuffix(first, ".git")) {
			apierr.Write(w, apierr.NotFound("repo %q not found", first))
			return
		}
		s.backend.ServeHTTP(w, r)
	})
	return mux
}
