// Package sigdiff is a client for the TS exported-signature differ
// (packages/sigdiff), driven in its long-running `--serve` mode.
package sigdiff

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"sync"
	"time"
)

// Change classes, ordered none < additive < body < signature.
const (
	ClassNone      = "none"
	ClassAdditive  = "additive"
	ClassBody      = "body"
	ClassSignature = "signature"
)

// Severities.
const (
	SeverityIgnore    = "ignore"
	SeverityReview    = "review"
	SeverityInterrupt = "interrupt"
)

// Result is one classification.
type Result struct {
	Class    string          `json:"class"`
	Severity string          `json:"severity"`
	Reason   string          `json:"reason"`
	Symbols  json.RawMessage `json:"symbols,omitempty"`
}

// SeverityOf maps a class to its severity.
func SeverityOf(class string) string {
	switch class {
	case ClassNone, ClassAdditive:
		return SeverityIgnore
	case ClassSignature:
		return SeverityInterrupt
	default:
		return SeverityReview
	}
}

// Rank orders classes (unknown classes rank as body).
func Rank(class string) int {
	switch class {
	case ClassNone:
		return 0
	case ClassAdditive:
		return 1
	case ClassSignature:
		return 3
	default:
		return 2
	}
}

// Client talks to `node sigdiff.cjs --serve`. Safe for concurrent use;
// requests are serialized over one process that is restarted on failure.
type Client struct {
	Script  string
	Node    string
	Timeout time.Duration

	mu     sync.Mutex
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	lines  chan []byte
	nextID int64
}

// New returns a client for the given script path (it may not exist; then
// every call falls back to body/review).
func New(script string) *Client {
	return &Client{Script: script, Node: "node", Timeout: 30 * time.Second}
}

// Available reports whether the sigdiff script exists.
func (c *Client) Available() bool {
	if c == nil || c.Script == "" {
		return false
	}
	_, err := os.Stat(c.Script)
	return err == nil
}

func fallback(reason string) Result {
	return Result{Class: ClassBody, Severity: SeverityReview, Reason: reason}
}

type request struct {
	Old  *string `json:"old"`
	New  *string `json:"new"`
	Path string  `json:"path"`
	ID   int64   `json:"id"`
}

type response struct {
	Result
	ID    *int64 `json:"id"`
	Error string `json:"error"`
}

func strPtr(b []byte, present bool) *string {
	if !present {
		return nil
	}
	s := string(b)
	return &s
}

// Diff classifies the change old→new of repoPath. A nil slice with
// present=false means the file is absent on that side. Never fails: any
// problem yields class body / severity review.
func (c *Client) Diff(ctx context.Context, repoPath string, old []byte, oldPresent bool, new []byte, newPresent bool) Result {
	res, ok := c.Classify(ctx, repoPath, old, oldPresent, new, newPresent)
	if !ok {
		return fallback(res.Reason)
	}
	return res
}

// Classify is Diff without the fallback: ok=false when sigdiff is missing
// or failed (res.Reason says why).
func (c *Client) Classify(ctx context.Context, repoPath string, old []byte, oldPresent bool, new []byte, newPresent bool) (Result, bool) {
	if oldPresent == newPresent && bytes.Equal(old, new) {
		return Result{Class: ClassNone, Severity: SeverityIgnore, Reason: "unchanged"}, true
	}
	if !c.Available() {
		return Result{Reason: "sigdiff unavailable"}, false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	for attempt := 0; attempt < 2; attempt++ {
		res, err := c.callLocked(ctx, request{Old: strPtr(old, oldPresent), New: strPtr(new, newPresent), Path: repoPath})
		if err == nil {
			if res.Class == "" {
				res.Class = ClassBody
			}
			if res.Severity == "" {
				res.Severity = SeverityOf(res.Class)
			}
			return res, true
		}
		log.Printf("sigdiff: %s: %v", repoPath, err)
		c.stopLocked()
		if ctx.Err() != nil {
			break
		}
	}
	return Result{Reason: "sigdiff failed"}, false
}

func (c *Client) startLocked() error {
	cmd := exec.Command(c.Node, c.Script, "--serve")
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return err
	}
	lines := make(chan []byte, 16)
	go func() {
		defer close(lines)
		sc := bufio.NewScanner(stdout)
		sc.Buffer(make([]byte, 64<<10), 64<<20)
		for sc.Scan() {
			lines <- append([]byte(nil), sc.Bytes()...)
		}
	}()
	c.cmd, c.stdin, c.lines = cmd, stdin, lines
	return nil
}

func (c *Client) stopLocked() {
	if c.cmd == nil {
		return
	}
	_ = c.stdin.Close()
	_ = c.cmd.Process.Kill()
	_ = c.cmd.Wait()
	c.cmd, c.stdin, c.lines = nil, nil, nil
}

// Close stops the server process.
func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.stopLocked()
}

func (c *Client) callLocked(ctx context.Context, req request) (Result, error) {
	if c.cmd == nil {
		if err := c.startLocked(); err != nil {
			return Result{}, err
		}
	}
	c.nextID++
	req.ID = c.nextID
	line, err := json.Marshal(req)
	if err != nil {
		return Result{}, err
	}
	if _, err := c.stdin.Write(append(line, '\n')); err != nil {
		return Result{}, err
	}
	timer := time.NewTimer(c.Timeout)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return Result{}, ctx.Err()
		case <-timer.C:
			return Result{}, fmt.Errorf("timeout after %s", c.Timeout)
		case raw, ok := <-c.lines:
			if !ok {
				return Result{}, fmt.Errorf("sigdiff exited")
			}
			var resp response
			if err := json.Unmarshal(raw, &resp); err != nil {
				continue // not a result line
			}
			if resp.ID != nil && *resp.ID != req.ID {
				continue // stale response from an earlier, timed-out request
			}
			if resp.Error != "" {
				return Result{}, fmt.Errorf("sigdiff error: %s", resp.Error)
			}
			return resp.Result, nil
		}
	}
}
