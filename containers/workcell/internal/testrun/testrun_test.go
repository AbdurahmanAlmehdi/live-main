package testrun

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseReport(t *testing.T) {
	dir := t.TempDir()
	report := filepath.Join(dir, "r.json")
	cwd := "/var/livemain/mnt/ws1"
	json := `{"numPassedTests":3,"numFailedTests":1,"testResults":[
	 {"name":"/var/livemain/mnt/ws1/tests/functions/SUM.test.ts","status":"passed","message":"","assertionResults":[{"fullName":"SUM adds","title":"adds","status":"passed","failureMessages":[]}]},
	 {"name":"/var/livemain/mnt/ws1/tests/functions/MAX.test.ts","status":"failed","message":"","assertionResults":[{"fullName":"MAX finds","title":"finds","status":"failed","failureMessages":["expected '#NAME?' to be close to 7"]}]},
	 {"name":"/var/livemain/mnt/ws1/tests/functions/BAD.test.ts","status":"failed","message":"SyntaxError: boom","assertionResults":[]}
	]}`
	if err := os.WriteFile(report, []byte(json), 0o644); err != nil {
		t.Fatal(err)
	}
	var res Result
	if err := parseReport(report, cwd, &res); err != nil {
		t.Fatal(err)
	}
	if res.Passed != 3 || res.Failed != 1 || len(res.Files) != 3 {
		t.Fatalf("res = %+v", res)
	}
	byFile := map[string]FileResult{}
	for _, f := range res.Files {
		byFile[f.File] = f
	}
	if f := byFile["tests/functions/MAX.test.ts"]; f.OK || len(f.Failures) != 1 || f.Failures[0].Name != "MAX finds" {
		t.Fatalf("MAX = %+v", f)
	}
	if f := byFile["tests/functions/BAD.test.ts"]; f.OK || len(f.Failures) != 1 || f.Failures[0].Message != "SyntaxError: boom" {
		t.Fatalf("BAD = %+v", f)
	}
	if f := byFile["tests/functions/SUM.test.ts"]; !f.OK || f.Failures == nil {
		t.Fatalf("SUM = %+v", f)
	}
}

func TestTailBuffer(t *testing.T) {
	tb := &tailBuffer{max: 10}
	for i := 0; i < 100; i++ {
		tb.Write([]byte("0123456789"))
	}
	if s := tb.String(); len(s) != 13 || s[:3] != "..." {
		t.Fatalf("tail = %q", s)
	}
}
