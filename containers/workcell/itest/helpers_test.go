//go:build itest

// Package itest drives a running gitserver + integrator + workcell (started
// by scripts/itest.sh) through the HTTP API and docker exec.
package itest

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"slices"
	"strings"
	"testing"
	"time"
)

// J is a decoded JSON object.
type J = map[string]any

var (
	gitURL      = os.Getenv("ITEST_GITSERVER")
	intURL      = os.Getenv("ITEST_INTEGRATOR")
	wcURL       = os.Getenv("ITEST_WORKCELL")
	wcContainer = os.Getenv("ITEST_WORKCELL_CONTAINER")
	remoteBase  = "http://gitserver:8090"
	httpClient  = &http.Client{Timeout: 5 * time.Minute}
)

func call(t *testing.T, method, url string, body any) (int, J, []byte) {
	t.Helper()
	var rd io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, url, rd)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, url, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var j J
	_ = json.Unmarshal(raw, &j)
	return resp.StatusCode, j, raw
}

// must performs a call and fails unless it returns 2xx.
func must(t *testing.T, method, url string, body any) J {
	t.Helper()
	status, j, raw := call(t, method, url, body)
	if status/100 != 2 {
		t.Fatalf("%s %s: HTTP %d: %s", method, url, status, raw)
	}
	return j
}

// mustFail performs a call and asserts the HTTP status and error code.
func mustFail(t *testing.T, method, url string, body any, status int, code string) J {
	t.Helper()
	got, j, raw := call(t, method, url, body)
	if got != status || j["error"] != code {
		t.Fatalf("%s %s: want HTTP %d %q, got %d: %s", method, url, status, code, got, raw)
	}
	return j
}

func ws(id, suffix string) string { return wcURL + "/workspaces/" + id + suffix }

func str(j J, k string) string {
	s, _ := j[k].(string)
	return s
}

func num(j J, k string) int {
	f, _ := j[k].(float64)
	return int(f)
}

func objs(j J, k string) []J {
	arr, _ := j[k].([]any)
	out := make([]J, 0, len(arr))
	for _, a := range arr {
		if m, ok := a.(J); ok {
			out = append(out, m)
		}
	}
	return out
}

func strs(j J, k string) []string {
	arr, _ := j[k].([]any)
	out := make([]string, 0, len(arr))
	for _, a := range arr {
		if s, ok := a.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

func contains(xs []string, x string) bool { return slices.Contains(xs, x) }

func requireContains(t *testing.T, what string, xs []string, want ...string) {
	t.Helper()
	for _, w := range want {
		if !contains(xs, w) {
			t.Fatalf("%s %v missing %q", what, xs, w)
		}
	}
}

func requireAbsent(t *testing.T, what string, xs []string, bad ...string) {
	t.Helper()
	for _, b := range bad {
		if contains(xs, b) {
			t.Fatalf("%s %v unexpectedly contains %q", what, xs, b)
		}
	}
	for _, x := range xs {
		if strings.HasPrefix(x, "node_modules/") || strings.HasPrefix(x, ".livemain/") || strings.HasPrefix(x, ".git/") {
			t.Fatalf("%s contains ignored path %q", what, x)
		}
	}
}

// dexec runs a shell script inside the workcell container.
func dexec(t *testing.T, script string) string {
	t.Helper()
	out, err := exec.Command("docker", "exec", wcContainer, "sh", "-c", script).CombinedOutput()
	if err != nil {
		t.Fatalf("docker exec %q: %v\n%s", script, err, out)
	}
	return string(out)
}

func dexecOK(script string) bool {
	return exec.Command("docker", "exec", wcContainer, "sh", "-c", script).Run() == nil
}

// --- convenience wrappers ---

func createRepo(t *testing.T, name string) string {
	t.Helper()
	return str(must(t, "POST", gitURL+"/repos", J{"name": name}), "remote")
}

func mainHead(t *testing.T, repo string) string {
	t.Helper()
	return str(must(t, "GET", gitURL+"/repos/"+repo+"/refs/heads/main", nil), "sha")
}

func remoteFile(t *testing.T, repo, ref, path string) (int, string) {
	t.Helper()
	resp, err := httpClient.Get(fmt.Sprintf("%s/repos/%s/file?ref=%s&path=%s", gitURL, repo, ref, path))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(b)
}

func createWS(t *testing.T, id, kind, remote, sha string) J {
	t.Helper()
	body := J{"id": id, "kind": kind, "remote": remote, "sha": sha}
	if kind == "clone" {
		body["branch"] = "agent/" + id
	}
	j := must(t, "POST", wcURL+"/workspaces", body)
	t.Cleanup(func() { call(t, "DELETE", ws(id, ""), nil) })
	return j
}

func read(t *testing.T, id, path string) string {
	t.Helper()
	return str(must(t, "POST", ws(id, "/fs/read"), J{"path": path}), "content")
}

func write(t *testing.T, id, path, content string) {
	t.Helper()
	must(t, "POST", ws(id, "/fs/write"), J{"path": path, "content": content})
}

func edit(t *testing.T, id, path, old, new string) {
	t.Helper()
	must(t, "POST", ws(id, "/fs/edit"), J{"path": path, "oldString": old, "newString": new})
}

func runTests(t *testing.T, id string, files ...string) J {
	t.Helper()
	body := J{"timeoutMs": 120000}
	if len(files) > 0 {
		body["files"] = files
	}
	return must(t, "POST", ws(id, "/test"), body)
}

func requireGreen(t *testing.T, res J) {
	t.Helper()
	if res["ok"] != true || num(res, "failed") != 0 || num(res, "passed") == 0 {
		b, _ := json.MarshalIndent(res, "", "  ")
		t.Fatalf("tests not green:\n%s", b)
	}
}

func overlay(t *testing.T, id string) J {
	t.Helper()
	return must(t, "GET", ws(id, "/overlay"), nil)
}

func checkpoint(t *testing.T, id, to string) J {
	t.Helper()
	return must(t, "POST", ws(id, "/checkpoint"), J{"toSha": to})
}

// promote integrates a workspace's overlay (what the coordinator does).
func promote(t *testing.T, id, remote, head string, extra J) J {
	t.Helper()
	ov := overlay(t, id)
	body := J{
		"remote": remote, "expectedHeadSha": head, "pinSha": str(ov, "pinSha"),
		"changes": ov["changes"], "message": "promote " + id, "author": id + " <" + id + "@livemain>",
	}
	for k, v := range extra {
		body[k] = v
	}
	return must(t, "POST", intURL+"/integrate", body)
}

func gitOp(t *testing.T, id string, body J) J {
	t.Helper()
	return must(t, "POST", ws(id, "/git"), body)
}

func noticeFor(t *testing.T, notices []J, path string) J {
	t.Helper()
	for _, n := range notices {
		if str(n, "path") == path {
			return n
		}
	}
	return nil
}

func logJSON(t *testing.T, label string, v any) {
	t.Helper()
	b, _ := json.MarshalIndent(v, "", "  ")
	t.Logf("%s: %s", label, b)
}
