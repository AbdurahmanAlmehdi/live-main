package sigdiff_test

import (
	"context"
	"path/filepath"
	"testing"

	"livemain/workcell/internal/sigdiff"
	"livemain/workcell/internal/testutil"
)

func TestClientAgainstStub(t *testing.T) {
	testutil.RequireNode(t)
	c := sigdiff.New(filepath.Join(testutil.TestdataDir(), "sigdiff-stub.cjs"))
	defer c.Close()
	ctx := context.Background()
	cases := []struct {
		old, new        string
		oldOK, newOK    bool
		class, severity string
	}{
		{"a\n", "a\n", true, true, sigdiff.ClassNone, sigdiff.SeverityIgnore},
		{"", "export const x = 1;\n", false, true, sigdiff.ClassAdditive, sigdiff.SeverityIgnore},
		{"a\nb\n", "a\nx\nb\n", true, true, sigdiff.ClassAdditive, sigdiff.SeverityIgnore},
		{"export function f(a: number) {\n  return a;\n}\n", "export function f(a: number) {\n  return a + 1;\n}\n", true, true, sigdiff.ClassBody, sigdiff.SeverityReview},
		{"export function f(a: number) {}\n", "export function f(a: string) {}\n", true, true, sigdiff.ClassSignature, sigdiff.SeverityInterrupt},
	}
	for i, tc := range cases {
		res := c.Diff(ctx, "x.ts", []byte(tc.old), tc.oldOK, []byte(tc.new), tc.newOK)
		if res.Class != tc.class || res.Severity != tc.severity {
			t.Errorf("case %d: got %s/%s want %s/%s (%s)", i, res.Class, res.Severity, tc.class, tc.severity, res.Reason)
		}
	}
}

func TestMissingScriptFallsBackToReview(t *testing.T) {
	c := sigdiff.New("/nonexistent/sigdiff.cjs")
	res := c.Diff(context.Background(), "x.ts", []byte("a"), true, []byte("b"), true)
	if res.Class != sigdiff.ClassBody || res.Severity != sigdiff.SeverityReview {
		t.Fatalf("fallback = %+v", res)
	}
}

func TestRankAndSeverity(t *testing.T) {
	if !(sigdiff.Rank("none") < sigdiff.Rank("additive") && sigdiff.Rank("additive") < sigdiff.Rank("body") && sigdiff.Rank("body") < sigdiff.Rank("signature")) {
		t.Fatal("rank order")
	}
	if sigdiff.SeverityOf("signature") != "interrupt" || sigdiff.SeverityOf("additive") != "ignore" {
		t.Fatal("severity map")
	}
}
