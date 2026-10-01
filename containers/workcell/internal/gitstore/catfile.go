package gitstore

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strconv"
	"strings"
	"sync"
)

// ErrMissing is returned when an object is not in the repository.
var ErrMissing = errors.New("object missing")

// catFile is a persistent `git cat-file --batch` process. Requests are
// serialized; the process is restarted transparently after any I/O error.
type catFile struct {
	dir string

	mu     sync.Mutex
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout *bufio.Reader
}

func newCatFile(dir string) *catFile { return &catFile{dir: dir} }

func (c *catFile) start() error {
	cmd := exec.Command("git", "cat-file", "--batch")
	cmd.Dir = c.dir
	cmd.Env = Env()
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start cat-file: %w", err)
	}
	c.cmd, c.stdin, c.stdout = cmd, stdin, bufio.NewReaderSize(stdout, 64<<10)
	return nil
}

func (c *catFile) stopLocked() {
	if c.cmd == nil {
		return
	}
	_ = c.stdin.Close()
	_ = c.cmd.Process.Kill()
	_ = c.cmd.Wait()
	c.cmd, c.stdin, c.stdout = nil, nil, nil
}

// Close terminates the process.
func (c *catFile) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.stopLocked()
}

// Read returns the object's type and content. It retries once on a fresh
// process (covers I/O errors and packs added after the process started).
func (c *catFile) Read(ctx context.Context, oid string) (string, []byte, error) {
	if !IsSHA(oid) {
		return "", nil, fmt.Errorf("cat-file: invalid object id %q", oid)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		if err := ctx.Err(); err != nil {
			return "", nil, err
		}
		if c.cmd == nil {
			if err := c.start(); err != nil {
				return "", nil, err
			}
		}
		typ, data, err := c.readLocked(oid)
		if err == nil {
			return typ, data, nil
		}
		lastErr = err
		c.stopLocked()
	}
	return "", nil, lastErr
}

func (c *catFile) readLocked(oid string) (string, []byte, error) {
	if _, err := io.WriteString(c.stdin, oid+"\n"); err != nil {
		return "", nil, err
	}
	header, err := c.stdout.ReadString('\n')
	if err != nil {
		return "", nil, err
	}
	fields := strings.Fields(header)
	if len(fields) == 2 && fields[1] == "missing" {
		return "", nil, fmt.Errorf("%s: %w", oid, ErrMissing)
	}
	if len(fields) != 3 {
		return "", nil, fmt.Errorf("cat-file: bad header %q", header)
	}
	size, err := strconv.ParseInt(fields[2], 10, 64)
	if err != nil || size < 0 {
		return "", nil, fmt.Errorf("cat-file: bad size in %q", header)
	}
	buf := make([]byte, size+1) // content + trailing LF
	if _, err := io.ReadFull(c.stdout, buf); err != nil {
		return "", nil, err
	}
	return fields[1], buf[:size], nil
}
