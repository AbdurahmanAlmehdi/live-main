package workspace

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
)

// Notice is a checkpoint (or coordinator) notification.
type Notice struct {
	Path        string  `json:"path"`
	Kind        string  `json:"kind"`
	Severity    string  `json:"severity"`
	Reason      string  `json:"reason"`
	Diff        string  `json:"diff"`
	MergeResult *string `json:"mergeResult"`
	MergeMethod *string `json:"mergeMethod"`
	// Extra context (not in the minimal contract shape, harmless to readers).
	Generation uint64 `json:"generation,omitempty"`
	FromSha    string `json:"fromSha,omitempty"`
	ToSha      string `json:"toSha,omitempty"`
}

// Inbox is an append-only list of notices. Coordinator-originated notices
// are stored verbatim (any JSON object).
type Inbox struct {
	mu      sync.Mutex
	notices []json.RawMessage
}

// Append adds notices.
func (in *Inbox) Append(items ...json.RawMessage) {
	in.mu.Lock()
	defer in.mu.Unlock()
	for _, it := range items {
		in.notices = append(in.notices, append(json.RawMessage(nil), it...))
	}
}

// AppendNotices marshals and appends.
func (in *Inbox) AppendNotices(ns []Notice) {
	raws := make([]json.RawMessage, 0, len(ns))
	for _, n := range ns {
		b, err := json.Marshal(n)
		if err == nil {
			raws = append(raws, b)
		}
	}
	in.Append(raws...)
}

// List returns all notices.
func (in *Inbox) List() []json.RawMessage {
	in.mu.Lock()
	defer in.mu.Unlock()
	out := make([]json.RawMessage, len(in.notices))
	copy(out, in.notices)
	return out
}

// Render formats the inbox as text, one block per notice.
func (in *Inbox) Render() []byte {
	list := in.List()
	if len(list) == 0 {
		return []byte("(no notices)\n")
	}
	var b strings.Builder
	for i, raw := range list {
		var m map[string]any
		if err := json.Unmarshal(raw, &m); err != nil {
			continue
		}
		fmt.Fprintf(&b, "=== notice %d", i+1)
		if g, ok := m["generation"].(float64); ok {
			fmt.Fprintf(&b, " (generation %d)", int64(g))
		}
		b.WriteString(" ===\n")
		for _, k := range []string{"path", "kind", "severity", "reason", "mergeResult", "mergeMethod", "toSha"} {
			if v, ok := m[k]; ok && v != nil && v != "" {
				fmt.Fprintf(&b, "%s: %v\n", k, v)
			}
		}
		extra := make([]string, 0, len(m))
		for k := range m {
			switch k {
			case "path", "kind", "severity", "reason", "mergeResult", "mergeMethod", "toSha", "generation", "fromSha", "diff":
				continue
			}
			extra = append(extra, k)
		}
		sort.Strings(extra)
		for _, k := range extra {
			if v := m[k]; v != nil && v != "" {
				fmt.Fprintf(&b, "%s: %v\n", k, v)
			}
		}
		if d, ok := m["diff"].(string); ok && d != "" {
			b.WriteString("diff:\n")
			b.WriteString(d)
			if !strings.HasSuffix(d, "\n") {
				b.WriteByte('\n')
			}
		}
		b.WriteByte('\n')
	}
	return []byte(b.String())
}
