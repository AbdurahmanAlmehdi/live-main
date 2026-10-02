// Package apierr defines the structured error type every HTTP handler returns.
//
// Handlers render an *Error as `{"error": code, "message": msg, ...extra}` with
// the given HTTP status; any other error becomes a 500 `internal`.
package apierr

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

// Error is a client-visible failure with a stable machine-readable code.
type Error struct {
	Status  int
	Code    string
	Message string
	// Extra fields merged into the JSON body (e.g. "paths", "results").
	Extra map[string]any
}

func (e *Error) Error() string { return fmt.Sprintf("%s: %s", e.Code, e.Message) }

// New builds an Error.
func New(status int, code, format string, args ...any) *Error {
	return &Error{Status: status, Code: code, Message: fmt.Sprintf(format, args...)}
}

// With returns a copy of e carrying an extra JSON field.
func (e *Error) With(key string, value any) *Error {
	c := *e
	c.Extra = make(map[string]any, len(e.Extra)+1)
	for k, v := range e.Extra {
		c.Extra[k] = v
	}
	c.Extra[key] = value
	return &c
}

// Convenience constructors for the common cases.

func BadRequest(format string, args ...any) *Error {
	return New(http.StatusBadRequest, "bad-request", format, args...)
}

func NotFound(format string, args ...any) *Error {
	return New(http.StatusNotFound, "not-found", format, args...)
}

func Conflict(code, format string, args ...any) *Error {
	return New(http.StatusConflict, code, format, args...)
}

// As extracts an *Error from err, if any.
func As(err error) (*Error, bool) {
	var e *Error
	if errors.As(err, &e) {
		return e, true
	}
	return nil, false
}

// WriteJSON writes v as a JSON response.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Write renders err as a structured JSON error.
func Write(w http.ResponseWriter, err error) {
	if e, ok := As(err); ok {
		body := map[string]any{"error": e.Code, "message": e.Message}
		for k, v := range e.Extra {
			if k != "error" && k != "message" {
				body[k] = v
			}
		}
		WriteJSON(w, e.Status, body)
		return
	}
	status, code := http.StatusInternalServerError, "internal"
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		status, code = http.StatusGatewayTimeout, "timeout"
	}
	WriteJSON(w, status, map[string]any{"error": code, "message": err.Error()})
}

// Decode parses a JSON request body into v (max 64 MiB). An empty body
// leaves v untouched. It writes the error response and returns false on
// failure.
func Decode(w http.ResponseWriter, r *http.Request, v any) bool {
	err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<20)).Decode(v)
	if err != nil && !errors.Is(err, io.EOF) {
		Write(w, BadRequest("invalid JSON body: %v", err))
		return false
	}
	return true
}
