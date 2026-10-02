// Package api exposes the workcell / integrator HTTP API (docs/workcell-api.md).
package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"livemain/workcell/internal/apierr"
	"livemain/workcell/internal/integrator"
	"livemain/workcell/internal/merge"
	"livemain/workcell/internal/workspace"
)

// Roles.
const (
	RoleWorkcell   = "workcell"
	RoleIntegrator = "integrator"
)

// Server routes HTTP requests to the workspace manager and integrator.
type Server struct {
	Role       string
	Workspaces *workspace.Manager
	Integrator *integrator.Integrator // nil unless Role == integrator
	Merger     *merge.Merger
}

// Handler builds the router.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)

	mux.HandleFunc("GET /workspaces", func(w http.ResponseWriter, r *http.Request) {
		apierr.WriteJSON(w, http.StatusOK, map[string]any{"workspaces": s.Workspaces.List(r.Context())})
	})
	mux.HandleFunc("POST /workspaces", s.createWorkspace)
	mux.HandleFunc("GET /workspaces/{id}", s.withWS(func(w http.ResponseWriter, r *http.Request, ws *workspace.Workspace) {
		apierr.WriteJSON(w, http.StatusOK, ws.Info(r.Context()))
	}))
	mux.HandleFunc("DELETE /workspaces/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := s.Workspaces.Delete(r.Context(), r.PathValue("id")); err != nil {
			apierr.Write(w, err)
			return
		}
		ok(w, map[string]any{})
	})

	mux.HandleFunc("POST /workspaces/{id}/fs/read", s.withWS(s.fsRead))
	mux.HandleFunc("POST /workspaces/{id}/fs/write", s.withWS(s.fsWrite))
	mux.HandleFunc("POST /workspaces/{id}/fs/edit", s.withWS(s.fsEdit))
	mux.HandleFunc("POST /workspaces/{id}/fs/delete", s.withWS(s.fsDelete))
	mux.HandleFunc("POST /workspaces/{id}/fs/revert", s.withWS(s.fsRevert))
	mux.HandleFunc("POST /workspaces/{id}/snapshot", s.withWS(s.snapshot))
	mux.HandleFunc("POST /workspaces/{id}/fs/list", s.withWS(s.fsList))
	mux.HandleFunc("POST /workspaces/{id}/fs/grep", s.withWS(s.fsGrep))

	mux.HandleFunc("POST /workspaces/{id}/test", s.withWS(s.test))
	mux.HandleFunc("POST /workspaces/{id}/checkpoint", s.withWS(s.checkpoint))
	mux.HandleFunc("GET /workspaces/{id}/overlay", s.withWS(s.overlay))
	mux.HandleFunc("POST /workspaces/{id}/readset/reset", s.withWS(s.resetReadSet))
	mux.HandleFunc("GET /workspaces/{id}/inbox", s.withWS(s.inboxGet))
	mux.HandleFunc("POST /workspaces/{id}/inbox", s.withWS(s.inboxPost))
	mux.HandleFunc("POST /workspaces/{id}/git", s.withWS(s.git))

	if s.Integrator != nil {
		mux.HandleFunc("POST /integrate", s.integrate)
		mux.HandleFunc("POST /ci", s.ci)
		mux.HandleFunc("POST /seed", s.seed)
	}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		apierr.Write(w, apierr.NotFound("no route for %s %s", r.Method, r.URL.Path))
	})
	return logRequests(recoverPanics(mux))
}

func ok(w http.ResponseWriter, fields map[string]any) {
	fields["ok"] = true
	apierr.WriteJSON(w, http.StatusOK, fields)
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	apierr.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"role":       s.Role,
		"workspaces": s.Workspaces.Count(),
		"mergiraf":   s.Merger.HasMergiraf(),
	})
}

func (s *Server) withWS(h func(http.ResponseWriter, *http.Request, *workspace.Workspace)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ws, err := s.Workspaces.Get(r.PathValue("id"))
		if err != nil {
			apierr.Write(w, err)
			return
		}
		h(w, r, ws)
	}
}

func (s *Server) createWorkspace(w http.ResponseWriter, r *http.Request) {
	var req workspace.CreateRequest
	if !apierr.Decode(w, r, &req) {
		return
	}
	ws, err := s.Workspaces.Create(r.Context(), req)
	if err != nil {
		apierr.Write(w, err)
		return
	}
	apierr.WriteJSON(w, http.StatusOK, ws.Info(r.Context()))
}

func (s *Server) fsRead(w http.ResponseWriter, r *http.Request, ws *workspace.Workspace) {
	var req workspace.ReadRequest
	if !apierr.Decode(w, r, &req) {
		return
	}
	res, err := ws.Read(req)
	if err != nil {
		apierr.Write(w, err)
		return
	}
	apierr.WriteJSON(w, http.StatusOK, res)
}

func (s *Server) fsWrite(w http.ResponseWriter, r *http.Request, ws *workspace.Workspace) {
	var req workspace.WriteRequest
	if !apierr.Decode(w, r, &req) {
		return
	}
	if err := ws.Write(req); err != nil {
		apierr.Write(w, err)
		return
	}
	ok(w, map[string]any{})
}

func (s *Server) fsEdit(w http.ResponseWriter, r *http.Request, ws *workspace.Workspace) {
	var req workspace.EditRequest
	if !apierr.Decode(w, r, &req) {
		return
	}
	n, err := ws.Edit(req)
	if err != nil {
		apierr.Write(w, err)
		return
	}
	ok(w, map[string]any{"replacements": n})
}

func (s *Server) fsDelete(w http.ResponseWriter, r *http.Request, ws *workspace.Workspace) {
	var req struct {
		Path string `json:"path"`
	}
	if !apierr.Decode(w, r, &req) {
		return
	}
	if err := ws.Delete(req.Path); err != nil {
		apierr.Write(w, err)
		return
	}
	ok(w, map[string]any{})
}

func (s *Server) snapshot(w http.ResponseWriter, r *http.Request, ws *workspace.Workspace) {
	var req workspace.SnapshotRequest
	if !apierr.Decode(w, r, &req) {
		return
	}
	res, err := s.Workspaces.Snapshot(r.Context(), ws, req)
	if err != nil {
		apierr.Write(w, err)
		return
	}
	ok(w, map[string]any{"sha": res.Sha, "parent": res.Parent, "ref": res.Ref, "changes": res.Changes})
}

func (s *Server) fsRevert(w http.ResponseWriter, r *http.Request, ws *workspace.Workspace) {
	var req struct {
		Path string `json:"path"`
	}
	if !apierr.Decode(w, r, &req) {
		return
	}
	if err := s.Workspaces.Revert(r.Context(), ws, req.Path); err != nil {
		apierr.Write(w, err)
		return
	}
	ok(w, map[string]any{})
}

func (s *Server) fsList(w http.ResponseWriter, r *http.Request, ws *workspace.Workspace) {
	var req struct {
		Path      string `json:"path"`
		Recursive bool   `json:"recursive"`
	}
	if !apierr.Decode(w, r, &req) {
		return
	}
	entries, err := ws.List(req.Path, req.Recursive)
	if err != nil {
		apierr.Write(w, err)
		return
	}
	apierr.WriteJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

func (s *Server) fsGrep(w http.ResponseWriter, r *http.Request, ws *workspace.Workspace) {
	var req workspace.GrepRequest
	if !apierr.Decode(w, r, &req) {
		return
	}
	matches, truncated, err := ws.Grep(req)
	if err != nil {
		apierr.Write(w, err)
		return
	}
	apierr.WriteJSON(w, http.StatusOK, map[string]any{"matches": matches, "truncated": truncated})
}

func (s *Server) test(w http.ResponseWriter, r *http.Request, ws *workspace.Workspace) {
	var req workspace.TestRequest
	if !apierr.Decode(w, r, &req) {
		return
	}
	res, err := s.Workspaces.Test(r.Context(), ws, req)
	if err != nil {
		apierr.Write(w, err)
		return
	}
	apierr.WriteJSON(w, http.StatusOK, res)
}

func (s *Server) checkpoint(w http.ResponseWriter, r *http.Request, ws *workspace.Workspace) {
	var req struct {
		ToSha string `json:"toSha"`
	}
	if !apierr.Decode(w, r, &req) {
		return
	}
	res, err := s.Workspaces.Checkpoint(r.Context(), ws, req.ToSha)
	if err != nil {
		apierr.Write(w, err)
		return
	}
	apierr.WriteJSON(w, http.StatusOK, res)
}

func (s *Server) overlay(w http.ResponseWriter, r *http.Request, ws *workspace.Workspace) {
	res, err := s.Workspaces.Overlay(r.Context(), ws)
	if err != nil {
		apierr.Write(w, err)
		return
	}
	apierr.WriteJSON(w, http.StatusOK, res)
}

func (s *Server) resetReadSet(w http.ResponseWriter, r *http.Request, ws *workspace.Workspace) {
	if err := s.Workspaces.ResetReadSet(ws); err != nil {
		apierr.Write(w, err)
		return
	}
	ok(w, map[string]any{})
}

func (s *Server) inboxGet(w http.ResponseWriter, r *http.Request, ws *workspace.Workspace) {
	apierr.WriteJSON(w, http.StatusOK, map[string]any{"notices": ws.Inbox().List()})
}

func (s *Server) inboxPost(w http.ResponseWriter, r *http.Request, ws *workspace.Workspace) {
	var req struct {
		Notices []json.RawMessage `json:"notices"`
	}
	if !apierr.Decode(w, r, &req) {
		return
	}
	for _, n := range req.Notices {
		var obj map[string]any
		if err := json.Unmarshal(n, &obj); err != nil {
			apierr.Write(w, apierr.BadRequest("each notice must be a JSON object"))
			return
		}
	}
	ws.Inbox().Append(req.Notices...)
	ok(w, map[string]any{"count": len(ws.Inbox().List())})
}

func (s *Server) git(w http.ResponseWriter, r *http.Request, ws *workspace.Workspace) {
	var req workspace.GitRequest
	if !apierr.Decode(w, r, &req) {
		return
	}
	res, err := s.Workspaces.Git(r.Context(), ws, req)
	if err != nil {
		apierr.Write(w, err)
		return
	}
	apierr.WriteJSON(w, http.StatusOK, res)
}

func (s *Server) integrate(w http.ResponseWriter, r *http.Request) {
	var req integrator.IntegrateRequest
	if !apierr.Decode(w, r, &req) {
		return
	}
	res, err := s.Integrator.Integrate(r.Context(), req)
	if err != nil {
		apierr.Write(w, err)
		return
	}
	apierr.WriteJSON(w, http.StatusOK, res)
}

func (s *Server) ci(w http.ResponseWriter, r *http.Request) {
	var req integrator.CIRequest
	if !apierr.Decode(w, r, &req) {
		return
	}
	res, err := s.Integrator.CI(r.Context(), req)
	if err != nil {
		apierr.Write(w, err)
		return
	}
	apierr.WriteJSON(w, http.StatusOK, res)
}

func (s *Server) seed(w http.ResponseWriter, r *http.Request) {
	var req integrator.SeedRequest
	if !apierr.Decode(w, r, &req) {
		return
	}
	sha, err := s.Integrator.Seed(r.Context(), req)
	if err != nil {
		apierr.Write(w, err)
		return
	}
	apierr.WriteJSON(w, http.StatusOK, map[string]any{"sha": sha})
}

// ---- middleware ----

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

// Flush supports streaming handlers (git smart HTTP).
func (s *statusRecorder) Flush() {
	if f, ok := s.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, rec.status, time.Since(start).Round(time.Millisecond))
	})
}

func recoverPanics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				log.Printf("panic in %s %s: %v", r.Method, r.URL.Path, v)
				apierr.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "internal", "message": "internal error"})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// Wrap applies the standard middleware to any handler (used by serve-git).
func Wrap(h http.Handler) http.Handler { return logRequests(recoverPanics(h)) }
