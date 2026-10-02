package workspace

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestCleanPath(t *testing.T) {
	good := map[string]string{"src/a.ts": "src/a.ts", "src/": "src", "a": "a"}
	for in, want := range good {
		got, err := CleanPath(in, false)
		if err != nil || got != want {
			t.Errorf("CleanPath(%q) = %q, %v", in, got, err)
		}
	}
	for _, bad := range []string{"/etc/passwd", "../x", "a/../b", "a//b", "./a", "a\\b", ""} {
		if _, err := CleanPath(bad, false); err == nil {
			t.Errorf("CleanPath(%q) accepted", bad)
		}
	}
	if p, err := CleanPath("", true); err != nil || p != "" {
		t.Errorf("root not allowed: %v", err)
	}
}

func TestReservedWrite(t *testing.T) {
	for _, p := range []string{".livemain/inbox", "node_modules/x", "a/node_modules/b", ".git/config"} {
		if !reservedWrite(p) {
			t.Errorf("%s not reserved", p)
		}
	}
	if reservedWrite("src/node_modules.ts") {
		t.Error("false positive")
	}
}

func TestGlob(t *testing.T) {
	cases := []struct {
		glob, path string
		want       bool
	}{
		{"*.ts", "src/core/value.ts", true},
		{"*.ts", "src/core/value.tsx", false},
		{"*.{ts,tsx}", "a/b.tsx", true},
		{"src/**/*.ts", "src/core/value.ts", true},
		{"src/**/*.ts", "src/value.ts", true},
		{"src/**/*.ts", "tests/value.ts", false},
		{"tests/*.test.ts", "tests/a/b.test.ts", false},
	}
	for _, c := range cases {
		m, err := compileGlob(c.glob)
		if err != nil {
			t.Fatal(err)
		}
		if got := m(c.path); got != c.want {
			t.Errorf("glob %q on %q = %v", c.glob, c.path, got)
		}
	}
}

func TestInboxRender(t *testing.T) {
	var in Inbox
	if got := string(in.Render()); got != "(no notices)\n" {
		t.Fatalf("empty render %q", got)
	}
	in.AppendNotices([]Notice{{Path: "src/core/value.ts", Kind: KindReadWrite, Severity: "interrupt", Reason: "sig changed", Diff: "@@ -1 +1 @@\n", Generation: 2}})
	in.Append(json.RawMessage(`{"kind":"change-order","message":"flattenArgs now needs opts"}`))
	out := string(in.Render())
	for _, want := range []string{"notice 1 (generation 2)", "path: src/core/value.ts", "severity: interrupt", "diff:\n@@", "notice 2", "message: flattenArgs now needs opts"} {
		if !strings.Contains(out, want) {
			t.Errorf("render missing %q:\n%s", want, out)
		}
	}
	if len(in.List()) != 2 {
		t.Fatal("list")
	}
}
