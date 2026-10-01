//go:build itest

package itest

import (
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"
)

const (
	valuePath    = "src/core/value.ts"
	registryPath = "src/core/registry.ts"
	sumPath      = "src/functions/math/SUM.ts"
	marker       = "  // functions (one per line"
)

// shared state across the ordered subtests
var (
	mainRemote string
	v1         string
)

func registryLine(name string) string {
	return fmt.Sprintf("  %s: () => import('../functions/math/%s'),\n", name, name)
}

func fnSource(name, op string) string {
	return fmt.Sprintf(`import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/value';

const %s: FormulaFunction = (args) => {
  if (args.length === 0) return 0;
  return args.map((v) => toNumber(v)).reduce((a, b) => Math.%s(a, b));
};

export default %s;
`, name, op, name)
}

// addFunction implements a function in a workspace the way an agent would.
func addFunction(t *testing.T, id, name, op string) {
	t.Helper()
	write(t, id, "src/functions/math/"+name+".ts", fnSource(name, op))
	edit(t, id, registryPath, marker, strings.TrimSuffix(registryLine(name), "\n")+"\n"+marker)
}

func TestWorkcell(t *testing.T) {
	if gitURL == "" || intURL == "" || wcURL == "" || wcContainer == "" {
		t.Skip("run via scripts/itest.sh")
	}
	steps := []struct {
		name string
		fn   func(*testing.T)
	}{
		{"seed", testSeed},
		{"workspace_basics_and_read_set", testWorkspaceBasics},
		{"write_lands_in_upper_only", testWriteLandsInUpper},
		{"tests_on_mount_via_virtual_node_modules", testRunOnMount},
		{"delete_is_whiteout", testDeleteWhiteout},
		{"revert_restores_base", testRevert},
		{"snapshot_publishes_overlay", testSnapshot},
		{"generated_files_regenerated_not_merged", testGenerated},
		{"tests_run_as_isolated_uid", testIsolatedUID},
		{"worked_example_C_A_B", testWorkedExample},
		{"open_handle_survives_swap", testOpenHandleSurvivesSwap},
		{"checkpoint_write_write_conflict", testCheckpointConflict},
		{"integrate_head_moved_impact_failed_automerge", testIntegratePaths},
		{"clone_git_ops_with_rebase_conflict", testCloneGitOps},
		{"fuse_overhead", testOverhead},
	}
	for _, s := range steps {
		if !t.Run(s.name, s.fn) {
			t.Fatalf("step %s failed; stopping", s.name)
		}
	}
}

func testSeed(t *testing.T) {
	for _, u := range []string{gitURL, intURL, wcURL} {
		must(t, "GET", u+"/health", nil)
	}
	h := must(t, "GET", wcURL+"/health", nil)
	if h["role"] != "workcell" || h["mergiraf"] != true {
		t.Fatalf("workcell health = %v", h)
	}
	if must(t, "GET", intURL+"/health", nil)["role"] != "integrator" {
		t.Fatal("integrator role")
	}
	mainRemote = createRepo(t, "main")
	if mainRemote != remoteBase+"/main.git" {
		t.Fatalf("remote = %s", mainRemote)
	}
	mustFail(t, "GET", gitURL+"/repos/main/refs/heads/main", nil, 404, "not-found")
	v1 = str(must(t, "POST", intURL+"/seed", J{"remote": mainRemote, "dir": "/seed/fixture-repo", "message": "seed fixture"}), "sha")
	if mainHead(t, "main") != v1 {
		t.Fatal("seed did not land on main")
	}
	mustFail(t, "POST", intURL+"/seed", J{"remote": mainRemote, "dir": "/seed/fixture-repo"}, 409, "already-seeded")
	status, body := remoteFile(t, "main", v1, valuePath)
	if status != 200 || !strings.Contains(body, "export function toNumber(v: Value): number") {
		t.Fatalf("file endpoint: %d %q", status, body)
	}
	if status, _ := remoteFile(t, "main", v1, "node_modules/vitest/package.json"); status != 404 {
		t.Fatal("node_modules was seeded")
	}
	// Workcell endpoints that are integrator-only must not exist here.
	mustFail(t, "POST", wcURL+"/integrate", J{}, 404, "not-found")
}

func testWorkspaceBasics(t *testing.T) {
	j := createWS(t, "probe", "livefs", mainRemote, v1)
	if str(j, "path") != "/var/livemain/mnt/probe" || num(j, "generation") != 1 || str(j, "sha") != v1 {
		t.Fatalf("create = %v", j)
	}
	mustFail(t, "POST", wcURL+"/workspaces", J{"id": "probe", "kind": "livefs", "remote": mainRemote, "sha": v1}, 409, "exists")
	if g := must(t, "GET", ws("probe", ""), nil); str(g, "kind") != "livefs" {
		t.Fatalf("get = %v", g)
	}
	if !strings.Contains(read(t, "probe", valuePath), "toNumber") {
		t.Fatal("read via mount")
	}
	part := must(t, "POST", ws("probe", "/fs/read"), J{"path": valuePath, "offset": 3, "limit": 1})
	if str(part, "content") != "export function toNumber(v: Value): number {\n" || num(part, "totalLines") < 10 {
		t.Fatalf("windowed read = %v", part)
	}
	mustFail(t, "POST", ws("probe", "/fs/read"), J{"path": "src/nope.ts"}, 404, "not-found")
	mustFail(t, "POST", ws("probe", "/fs/read"), J{"path": "../etc/passwd"}, 400, "bad-request")
	// .livemain/inbox and node_modules are visible but never logged.
	if out := dexec(t, "cat /var/livemain/mnt/probe/.livemain/inbox; readlink /var/livemain/mnt/probe/node_modules"); !strings.Contains(out, "/deps/node_modules") {
		t.Fatalf("virtual entries: %q", out)
	}
	dexec(t, "cat /var/livemain/mnt/probe/node_modules/vitest/package.json >/dev/null")
	rs := strs(overlay(t, "probe"), "readSet")
	requireContains(t, "read set", rs, valuePath)
	requireAbsent(t, "read set", rs, ".livemain/inbox", "node_modules")
	list := must(t, "POST", ws("probe", "/fs/list"), J{"path": "", "recursive": true})
	var paths []string
	for _, e := range objs(list, "entries") {
		paths = append(paths, str(e, "path"))
	}
	requireContains(t, "list", paths, "src", "src/core/value.ts", "tests/functions/SUM.test.ts")
	requireAbsent(t, "list", paths, "node_modules", ".livemain")
	g := must(t, "POST", ws("probe", "/fs/grep"), J{"pattern": `toNumber\(`, "glob": "*.ts"})
	if len(objs(g, "matches")) < 3 || g["truncated"] != false {
		t.Fatalf("grep = %v", g)
	}
	g = must(t, "POST", ws("probe", "/fs/grep"), J{"pattern": `import`, "path": "src", "maxResults": 2})
	if len(objs(g, "matches")) != 2 || g["truncated"] != true {
		t.Fatalf("grep truncation = %v", g)
	}
	must(t, "POST", ws("probe", "/readset/reset"), nil)
	if rs := strs(overlay(t, "probe"), "readSet"); len(rs) != 0 {
		t.Fatalf("read set after reset = %v", rs)
	}
}

func testWriteLandsInUpper(t *testing.T) {
	createWS(t, "writer", "livefs", mainRemote, v1)
	addFunction(t, "writer", "MAX", "max")
	mustFail(t, "POST", ws("writer", "/fs/edit"), J{"path": registryPath, "oldString": "NOPE", "newString": "x"}, 409, "no-match")
	mustFail(t, "POST", ws("writer", "/fs/edit"), J{"path": registryPath, "oldString": "import(", "newString": "x"}, 409, "ambiguous")
	mustFail(t, "POST", ws("writer", "/fs/write"), J{"path": ".livemain/inbox", "content": "x"}, 400, "reserved-path")
	mustFail(t, "POST", ws("writer", "/fs/write"), J{"path": "node_modules/x.js", "content": "x"}, 400, "reserved-path")
	upper := "/var/livemain/upper/writer/"
	dexec(t, "test -f "+upper+"src/functions/math/MAX.ts && test -f "+upper+registryPath)
	if dexecOK("test -e " + upper + valuePath) {
		t.Fatal("unmodified file copied to upper")
	}
	if status, _ := remoteFile(t, "main", v1, "src/functions/math/MAX.ts"); status != 404 {
		t.Fatal("write leaked to the remote")
	}
	if mainHead(t, "main") != v1 {
		t.Fatal("main moved")
	}
	ov := overlay(t, "writer")
	var changed []string
	for _, c := range objs(ov, "changes") {
		changed = append(changed, str(c, "path"))
	}
	if strings.Join(changed, ",") != "src/core/registry.ts,src/functions/math/MAX.ts" {
		t.Fatalf("changes = %v", changed)
	}
	requireContains(t, "write set", strs(ov, "writeSet"), registryPath, "src/functions/math/MAX.ts")
	// Writing a file back to identical content is not a change.
	write(t, "writer", valuePath, read(t, "writer", valuePath))
	if n := len(objs(overlay(t, "writer"), "changes")); n != 2 {
		t.Fatalf("identical rewrite counted as change (%d changes)", n)
	}
}

func testRunOnMount(t *testing.T) {
	createWS(t, "runner", "livefs", mainRemote, v1)
	res := runTests(t, "runner", "tests/functions/SUM.test.ts")
	requireGreen(t, res)
	if num(res, "passed") != 3 || len(objs(res, "files")) != 1 || str(objs(res, "files")[0], "file") != "tests/functions/SUM.test.ts" {
		t.Fatalf("result = %v", res)
	}
	rs := strs(overlay(t, "runner"), "readSet")
	requireContains(t, "read set", rs, "tests/functions/SUM.test.ts", "src/eval/evaluate.ts", registryPath, sumPath, valuePath, "vitest.config.ts")
	// The lazy registry keeps unrelated functions out of the read set; vite
	// still resolves (stats) every registry target, which lands in lookupSet.
	requireAbsent(t, "read set", rs, "src/functions/text/CONCAT.ts", "src/functions/math/AVERAGE.ts", "tests/functions/CONCAT.test.ts")
	ls := strs(overlay(t, "runner"), "lookupSet")
	requireContains(t, "lookup set", ls, "src/functions/text/CONCAT.ts")
	requireAbsent(t, "lookup set", ls, sumPath)
	t.Logf("single-function test: read set (%d files) %v; lookup-only %v", len(rs), rs, ls)

	// A failing file reports structured failures.
	res = runTests(t, "runner", "tests/functions/MIN.test.ts")
	if res["ok"] != false || num(res, "failed") != 2 {
		t.Fatalf("failing run = %v", res)
	}
	f := objs(res, "files")[0]
	if f["ok"] != false || len(objs(f, "failures")) != 2 || !strings.Contains(str(objs(f, "failures")[0], "message"), "#NAME?") {
		t.Fatalf("failures = %v", f)
	}
	// Whole suite: everything but MAX/MIN passes.
	res = runTests(t, "runner")
	if num(res, "passed") != 9 || num(res, "failed") != 4 || len(objs(res, "files")) != 6 {
		t.Fatalf("suite = passed %d failed %d", num(res, "passed"), num(res, "failed"))
	}
}

func testDeleteWhiteout(t *testing.T) {
	createWS(t, "deleter", "livefs", mainRemote, v1)
	const concat = "src/functions/text/CONCAT.ts"
	must(t, "POST", ws("deleter", "/fs/delete"), J{"path": concat})
	mustFail(t, "POST", ws("deleter", "/fs/read"), J{"path": concat}, 404, "not-found")
	mustFail(t, "POST", ws("deleter", "/fs/delete"), J{"path": concat}, 404, "not-found")
	list := must(t, "POST", ws("deleter", "/fs/list"), J{"path": "src/functions/text"})
	if len(objs(list, "entries")) != 0 {
		t.Fatalf("deleted file listed: %v", list)
	}
	if dexecOK("test -e /var/livemain/upper/deleter/" + concat) {
		t.Fatal("whiteout materialized as a file")
	}
	ov := overlay(t, "deleter")
	ch := objs(ov, "changes")
	if len(ch) != 1 || str(ch[0], "path") != concat || ch[0]["content"] != nil {
		t.Fatalf("changes = %v", ch)
	}
	requireContains(t, "write set", strs(ov, "writeSet"), concat)
	// Directory delete through the mount, then recreate a file in it.
	must(t, "POST", ws("deleter", "/fs/delete"), J{"path": "src/functions/math"})
	mustFail(t, "POST", ws("deleter", "/fs/read"), J{"path": sumPath}, 404, "not-found")
	write(t, "deleter", sumPath, "export default 1;\n")
	if read(t, "deleter", sumPath) != "export default 1;\n" {
		t.Fatal("recreated file")
	}
	ov = overlay(t, "deleter")
	got := map[string]bool{}
	for _, c := range objs(ov, "changes") {
		got[str(c, "path")] = c["content"] != nil
	}
	if !got[sumPath] || got["src/functions/math/AVERAGE.ts"] || len(got) != 3 {
		t.Fatalf("changes after dir delete = %v", got)
	}
}

// testWorkedExample: agents A, B, C pinned at v1. C changes value.ts (a
// signature change); A and B each add a function (registry line + file) and
// read value.ts through their tests. Promotions land in order C, A, B.
func testWorkedExample(t *testing.T) {
	for _, id := range []string{"A", "B", "C"} {
		createWS(t, id, "livefs", mainRemote, v1)
	}
	// C: contract change in value.ts.
	edit(t, "C", valuePath, "export function toNumber(v: Value): number {", "export function toNumber(v: Value, fallback = 0): number {")
	edit(t, "C", valuePath, "if (v === null || v === '') return 0;", "if (v === null || v === '') return fallback;")
	requireGreen(t, runTests(t, "C", "tests/functions/SUM.test.ts", "tests/core/value.test.ts"))
	// A and B: leaf tasks.
	addFunction(t, "A", "MAX", "max")
	requireGreen(t, runTests(t, "A", "tests/functions/MAX.test.ts"))
	addFunction(t, "B", "MIN", "min")
	requireGreen(t, runTests(t, "B", "tests/functions/MIN.test.ts"))
	ovA := overlay(t, "A")
	requireContains(t, "A read set", strs(ovA, "readSet"), valuePath, registryPath)
	if cl, _ := ovA["classes"].(J); cl[registryPath] != "additive" || cl["src/functions/math/MAX.ts"] != "additive" {
		t.Fatalf("A overlay classes = %v", ovA["classes"])
	}
	if cl, _ := overlay(t, "C")["classes"].(J); cl[valuePath] != "signature" {
		t.Fatalf("C overlay classes = %v", cl)
	}
	requireContains(t, "B read set", strs(overlay(t, "B"), "readSet"), valuePath, registryPath)

	// 1. C promotes first → v2. value.ts is a signature change, so its impact
	//    candidates run on the merged tree before the push.
	resC := promote(t, "C", mainRemote, v1, J{"impactCandidates": J{valuePath: []string{"tests/functions/SUM.test.ts", "tests/functions/AVERAGE.test.ts"}}})
	v2 := str(resC, "sha")
	classes := resC["classes"].(J)
	if classes[valuePath] != "signature" {
		t.Fatalf("C classes = %v", classes)
	}
	if ran := strs(resC, "impactRan"); len(ran) != 2 {
		t.Fatalf("C impactRan = %v", ran)
	}
	requireGreen(t, resC["impact"].(J))
	if mainHead(t, "main") != v2 {
		t.Fatal("C did not land")
	}

	// 2. A checkpoints to v2: value.ts is in A's read set → read-write, interrupt.
	cpA := checkpoint(t, "A", v2)
	logJSON(t, "A checkpoint", cpA)
	if num(cpA, "generation") != 2 || strings.Join(strs(cpA, "delta"), ",") != valuePath {
		t.Fatalf("A checkpoint = %v", cpA)
	}
	notices := objs(cpA, "notices")
	if len(notices) != 1 {
		t.Fatalf("A notices = %v", notices)
	}
	n := notices[0]
	if str(n, "path") != valuePath || str(n, "kind") != "read-write" || str(n, "severity") != "interrupt" || n["mergeResult"] != nil || !strings.Contains(str(n, "diff"), "fallback") {
		t.Fatalf("A notice = %v", n)
	}
	if inbox := dexec(t, "cat /var/livemain/mnt/A/.livemain/inbox"); !strings.Contains(inbox, valuePath) || !strings.Contains(inbox, "interrupt") {
		t.Fatalf("A inbox file = %q", inbox)
	}
	if len(objs(must(t, "GET", ws("A", "/inbox"), nil), "notices")) != 1 {
		t.Fatal("A inbox API")
	}
	if !strings.Contains(read(t, "A", valuePath), "fallback = 0") {
		t.Fatal("A does not see v2 value.ts after checkpoint")
	}
	requireGreen(t, runTests(t, "A", "tests/functions/MAX.test.ts"))

	// 3. A promotes → v3. The registry change is additive, so registry impact
	//    candidates (every landed test) are NOT re-run.
	resA := promote(t, "A", mainRemote, v2, J{"impactCandidates": J{registryPath: []string{"tests/functions/SUM.test.ts", "tests/functions/AVERAGE.test.ts", "tests/functions/CONCAT.test.ts"}}})
	v3 := str(resA, "sha")
	if c := resA["classes"].(J); c[registryPath] != "additive" || c["src/functions/math/MAX.ts"] != "additive" {
		t.Fatalf("A classes = %v", c)
	}
	if ran := strs(resA, "impactRan"); len(ran) != 0 || resA["impact"] != nil {
		t.Fatalf("A impact ran %v", ran)
	}

	// 4. B tries to promote without checkpointing: registry moved → needs-checkpoint.
	ovB := overlay(t, "B")
	nc := mustFail(t, "POST", intURL+"/integrate", J{"remote": mainRemote, "expectedHeadSha": v3, "pinSha": v1, "changes": ovB["changes"], "message": "B"}, 409, "needs-checkpoint")
	if strings.Join(strs(nc, "paths"), ",") != registryPath {
		t.Fatalf("needs-checkpoint paths = %v", nc["paths"])
	}

	// 5. B checkpoints v1 → v3: value.ts read-write (interrupt), registry
	//    write-write auto-merged, MAX.ts untouched by B → no notice.
	cpB := checkpoint(t, "B", v3)
	logJSON(t, "B checkpoint", cpB)
	delta := strs(cpB, "delta")
	sort.Strings(delta)
	if strings.Join(delta, ",") != "src/core/registry.ts,src/core/value.ts,src/functions/math/MAX.ts" {
		t.Fatalf("B delta = %v", delta)
	}
	notices = objs(cpB, "notices")
	if len(notices) != 2 {
		t.Fatalf("B notices = %v", notices)
	}
	if n := noticeFor(t, notices, valuePath); n == nil || str(n, "kind") != "read-write" || str(n, "severity") != "interrupt" {
		t.Fatalf("B value notice = %v", n)
	}
	reg := noticeFor(t, notices, registryPath)
	if reg == nil || str(reg, "kind") != "write-write" || str(reg, "mergeResult") != "merged" || str(reg, "severity") != "ignore" {
		t.Fatalf("B registry notice = %v", reg)
	}
	if m := str(reg, "mergeMethod"); m != "mergiraf" && m != "union" {
		t.Fatalf("merge method = %q", m)
	}
	merged := read(t, "B", registryPath)
	if !strings.Contains(merged, registryLine("MAX")) || !strings.Contains(merged, registryLine("MIN")) || strings.Contains(merged, "<<<<<<<") {
		t.Fatalf("B merged registry:\n%s", merged)
	}
	requireGreen(t, runTests(t, "B", "tests/functions/MIN.test.ts", "tests/functions/MAX.test.ts"))

	// 6. B promotes → v4; main has all three changes; CI is green.
	resB := promote(t, "B", mainRemote, v3, nil)
	v4 := str(resB, "sha")
	if str(resB, "parent") != v3 || mainHead(t, "main") != v4 {
		t.Fatal("B did not land")
	}
	_, reg4 := remoteFile(t, "main", v4, registryPath)
	for _, fn := range []string{"SUM", "AVERAGE", "CONCAT", "MAX", "MIN"} {
		if !strings.Contains(reg4, "  "+fn+": () =>") {
			t.Fatalf("v4 registry lacks %s:\n%s", fn, reg4)
		}
	}
	ci := must(t, "POST", intURL+"/ci", J{"remote": mainRemote, "sha": v4})
	requireGreen(t, ci)
	if str(ci, "sha") != v4 || num(ci, "passed") != 13 {
		t.Fatalf("ci = passed %d", num(ci, "passed"))
	}
	ci = must(t, "POST", intURL+"/ci", J{"remote": mainRemote, "sha": v1, "files": []string{"tests/functions/MAX.test.ts"}})
	if ci["ok"] != false {
		t.Fatal("ci on v1 MAX should fail")
	}
}

func testOpenHandleSurvivesSwap(t *testing.T) {
	head := mainHead(t, "main")
	createWS(t, "swap", "livefs", mainRemote, v1)
	old := read(t, "swap", valuePath)
	mnt := "/var/livemain/mnt/swap/" + valuePath
	dexec(t, "rm -f /tmp/opened /tmp/go /tmp/done /tmp/handle.out")
	dexec(t, "nohup sh -c 'exec 3< "+mnt+"; touch /tmp/opened; while [ ! -f /tmp/go ]; do sleep 0.05; done; cat <&3 > /tmp/handle.out; touch /tmp/done' >/dev/null 2>&1 &")
	waitFor(t, "/tmp/opened")
	cp := checkpoint(t, "swap", head)
	if num(cp, "generation") != 2 {
		t.Fatalf("generation = %v", cp["generation"])
	}
	// New opens see the new version immediately (explicit invalidation).
	start := time.Now()
	fresh := dexec(t, "cat "+mnt)
	size := strings.TrimSpace(dexec(t, "stat -c %s "+mnt))
	if !strings.Contains(fresh, "fallback = 0") || size != strconv.Itoa(len(fresh)) {
		t.Fatalf("fresh read after swap: size %s len %d\n%s", size, len(fresh), fresh)
	}
	if time.Since(start) > 900*time.Millisecond {
		t.Logf("warning: fresh read took %s", time.Since(start))
	}
	dexec(t, "touch /tmp/go")
	waitFor(t, "/tmp/done")
	if got := dexec(t, "cat /tmp/handle.out"); got != old {
		t.Fatalf("handle opened before the swap read:\n%s\nwant:\n%s", got, old)
	}
}

func waitFor(t *testing.T, file string) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for !dexecOK("test -f " + file) {
		if time.Now().After(deadline) {
			t.Fatalf("timeout waiting for %s", file)
		}
		time.Sleep(50 * time.Millisecond)
	}
}

func testCheckpointConflict(t *testing.T) {
	head := mainHead(t, "main")
	createWS(t, "up", "livefs", mainRemote, head)
	createWS(t, "conf", "livefs", mainRemote, head)
	const line = "args.reduce<number>((acc, v) => acc + toNumber(v), 0);"
	edit(t, "up", sumPath, line, "args.reduce<number>((total, v) => total + toNumber(v), 0);")
	v5 := str(promote(t, "up", mainRemote, head, nil), "sha")
	edit(t, "conf", sumPath, line, "args.reduce<number>((s, v) => s + toNumber(v, 0), 0);")
	cp := checkpoint(t, "conf", v5)
	n := noticeFor(t, objs(cp, "notices"), sumPath)
	if n == nil || str(n, "kind") != "write-write" || str(n, "mergeResult") != "conflict" || str(n, "severity") != "interrupt" {
		t.Fatalf("conflict notice = %v", n)
	}
	if body := read(t, "conf", sumPath); !strings.Contains(body, "<<<<<<<") || !strings.Contains(body, "total + toNumber") {
		t.Fatalf("conflicted file:\n%s", body)
	}
}

func testIntegratePaths(t *testing.T) {
	head := mainHead(t, "main")
	// head-moved: stale expected head.
	j := mustFail(t, "POST", intURL+"/integrate", J{"remote": mainRemote, "expectedHeadSha": v1, "pinSha": v1,
		"changes": []J{{"path": "x.ts", "content": "x"}}}, 409, "head-moved")
	if str(j, "headSha") != head {
		t.Fatalf("headSha = %v", j["headSha"])
	}
	// impact-failed: a broken SUM is caught before landing.
	createWS(t, "brk", "livefs", mainRemote, head)
	edit(t, "brk", sumPath, "+ toNumber(v)", "- toNumber(v)")
	ov := overlay(t, "brk")
	j = mustFail(t, "POST", intURL+"/integrate", J{"remote": mainRemote, "expectedHeadSha": head, "pinSha": head,
		"changes": ov["changes"], "impactTests": []string{"tests/functions/SUM.test.ts"}}, 409, "impact-failed")
	if res, _ := j["results"].(J); res == nil || res["ok"] != false || num(res, "failed") == 0 {
		t.Fatalf("impact results = %v", j["results"])
	}
	if mainHead(t, "main") != head {
		t.Fatal("main moved after impact failure")
	}
	// autoMerge: an overlay pinned at v1 adding a registry line lands on the
	// current head because the coordinator allows the registry to auto-merge.
	createWS(t, "late", "livefs", mainRemote, v1)
	addFunction(t, "late", "ABS", "abs")
	res := promote(t, "late", mainRemote, head, J{"autoMerge": []string{registryPath}})
	mergedList := objs(res, "merged")
	if len(mergedList) != 1 || str(mergedList[0], "path") != registryPath {
		t.Fatalf("merged = %v", res["merged"])
	}
	_, reg := remoteFile(t, "main", str(res, "sha"), registryPath)
	for _, fn := range []string{"MAX", "MIN", "ABS"} {
		if !strings.Contains(reg, "  "+fn+": () =>") {
			t.Fatalf("registry after auto-merge lacks %s:\n%s", fn, reg)
		}
	}
	// Non-force push semantics: integrating against the now-stale head fails.
	mustFail(t, "POST", intURL+"/integrate", J{"remote": mainRemote, "expectedHeadSha": head, "pinSha": head,
		"changes": []J{{"path": "y.ts", "content": "y"}}}, 409, "head-moved")
}

func testCloneGitOps(t *testing.T) {
	fork := must(t, "POST", gitURL+"/repos/main/fork", J{"name": "play"})
	remote := str(fork, "remote")
	base := mainHead(t, "play")
	if base != mainHead(t, "main") {
		t.Fatal("fork head differs")
	}
	x := createWS(t, "X", "clone", remote, base)
	createWS(t, "Y", "clone", remote, base)
	createWS(t, "Z", "clone", remote, base)
	if str(x, "path") != "/var/livemain/clones/X" {
		t.Fatalf("clone path = %v", x["path"])
	}
	h := gitOp(t, "X", J{"op": "head"})
	if str(h, "sha") != base || str(h, "branch") != "agent/X" {
		t.Fatalf("head = %v", h)
	}
	requireGreen(t, runTests(t, "X", "tests/functions/SUM.test.ts"))
	if st := gitOp(t, "X", J{"op": "status"}); st["clean"] != true {
		t.Fatalf("status after test run = %v (node_modules must be excluded)", st)
	}
	mustFail(t, "POST", ws("X", "/checkpoint"), J{"toSha": base}, 400, "bad-request")

	const line = "args.reduce<number>((total, v) => total + toNumber(v), 0);"
	edit(t, "X", sumPath, line, "args.reduce<number>((x, v) => x + toNumber(v), 0);")
	if d := gitOp(t, "X", J{"op": "diff"}); str(d, "diff") != "" {
		t.Fatalf("uncommitted edits must not show in the three-dot diff: %v", d)
	}
	if c := gitOp(t, "X", J{"op": "commit", "message": "X edit"}); c["ok"] != true {
		t.Fatalf("commit = %v", c)
	}
	if d := gitOp(t, "X", J{"op": "diff"}); !strings.Contains(str(d, "diff"), "diff --git a/"+sumPath+" b/"+sumPath) || !strings.Contains(str(d, "diff"), "(x, v)") {
		t.Fatalf("diff = %v", d)
	}
	if p := gitOp(t, "X", J{"op": "push"}); p["ok"] != true || p["rejected"] != false {
		t.Fatalf("X push = %v", p)
	}
	edit(t, "Y", sumPath, line, "args.reduce<number>((y, v) => y + toNumber(v), 0);")
	gitOp(t, "Y", J{"op": "commit", "message": "Y edit"})
	if p := gitOp(t, "Y", J{"op": "push"}); p["ok"] != false || p["rejected"] != true {
		t.Fatalf("Y push should be rejected: %v", p)
	}
	if f := gitOp(t, "Y", J{"op": "fetch"}); f["ok"] != true {
		t.Fatalf("fetch = %v", f)
	}
	rb := gitOp(t, "Y", J{"op": "rebase"})
	if rb["ok"] != false || strings.Join(strs(rb, "conflicts"), ",") != sumPath {
		t.Fatalf("rebase = %v", rb)
	}
	if st := gitOp(t, "Y", J{"op": "status"}); len(strs(st, "conflicts")) != 1 {
		t.Fatalf("status during conflict = %v", st)
	}
	if a := gitOp(t, "Y", J{"op": "rebase-abort"}); a["ok"] != true {
		t.Fatalf("abort = %v", a)
	}
	if st := gitOp(t, "Y", J{"op": "status"}); st["clean"] != true {
		t.Fatalf("status after abort = %v", st)
	}
	gitOp(t, "Y", J{"op": "rebase"})
	resolved := strings.Replace(read(t, "X", sumPath), "(x, v) => x +", "(acc, v) => acc +", 1)
	write(t, "Y", sumPath, resolved)
	if c := gitOp(t, "Y", J{"op": "rebase-continue"}); c["ok"] != true || len(strs(c, "conflicts")) != 0 {
		t.Fatalf("rebase-continue = %v", c)
	}
	if p := gitOp(t, "Y", J{"op": "push"}); p["ok"] != true {
		t.Fatalf("Y push after rebase = %v", p)
	}
	if mainHead(t, "play") != str(gitOp(t, "Y", J{"op": "head"}), "sha") {
		t.Fatal("play head != Y head")
	}
	// Z edits another file and merges.
	edit(t, "Z", "src/functions/text/CONCAT.ts", "join('')", "join(\"\")")
	gitOp(t, "Z", J{"op": "commit", "message": "Z edit"})
	gitOp(t, "Z", J{"op": "fetch"})
	if m := gitOp(t, "Z", J{"op": "merge"}); m["ok"] != true || len(strs(m, "conflicts")) != 0 {
		t.Fatalf("merge = %v", m)
	}
	if p := gitOp(t, "Z", J{"op": "push"}); p["ok"] != true {
		t.Fatalf("Z push = %v", p)
	}
	if mainHead(t, "main") == mainHead(t, "play") {
		t.Fatal("fork pushes leaked into main")
	}
}

// testOverhead times vitest on the FUSE mount vs a plain checkout, inside
// the workcell container (10 runs each, after one warm-up each).
func testOverhead(t *testing.T) {
	runs := 10
	if s := os.Getenv("ITEST_OVERHEAD_RUNS"); s != "" {
		runs, _ = strconv.Atoi(s)
	}
	type bench struct{ name, repo, files string }
	benches := []bench{{"fixture full suite", "main", ""}, {"fixture single test (SUM)", "main", "tests/functions/SUM.test.ts"}}
	if os.Getenv("ITEST_DEMO") == "1" {
		remote := createRepo(t, "demo")
		if _, j, _ := call(t, "POST", intURL+"/seed", J{"remote": remote, "dir": "/seed/demo-repo", "message": "seed demo"}); j["sha"] == nil && j["error"] != "already-seeded" {
			t.Fatalf("seed demo: %v", j)
		}
		benches = append(benches, bench{"demo-repo full suite", "demo", ""}, bench{"demo-repo single test (SUM)", "demo", "tests/functions/SUM.test.ts"})
	}
	var report strings.Builder
	for i, b := range benches {
		head := mainHead(t, b.repo)
		id := fmt.Sprintf("bench%d", i)
		createWS(t, id, "livefs", remoteBase+"/"+b.repo+".git", head)
		mnt := "/var/livemain/mnt/" + id
		plain := "/tmp/plain-" + id
		dexec(t, fmt.Sprintf("rm -rf %[1]s && mkdir -p %[1]s && git --git-dir=/var/livemain/mirror.git archive %[2]s | tar -x -C %[1]s && ln -s /deps/node_modules %[1]s/node_modules", plain, head))
		script := fmt.Sprintf(`
run() { cd "$1"; s=$(date +%%s%%N); LIVEMAIN_CACHE_DIR=/tmp/bench-cache-$2 node /deps/node_modules/vitest/vitest.mjs run %[1]s >/dev/null 2>&1; e=$(date +%%s%%N); echo $(( (e - s) / 1000000 )); }
run %[2]s mnt >/dev/null; run %[3]s plain >/dev/null
for i in $(seq %[4]d); do echo "mount $(run %[2]s mnt)"; echo "plain $(run %[3]s plain)"; done`, b.files, mnt, plain, runs)
		out := dexec(t, script)
		var m, p []float64
		for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
			f := strings.Fields(line)
			if len(f) != 2 {
				continue
			}
			v, _ := strconv.ParseFloat(f[1], 64)
			if f[0] == "mount" {
				m = append(m, v)
			} else {
				p = append(p, v)
			}
		}
		mm, pm := median(m), median(p)
		fmt.Fprintf(&report, "OVERHEAD %-30s runs=%d mount median=%.0fms mean=%.0fms | plain median=%.0fms mean=%.0fms | overhead(median)=%+.1f%%\n",
			b.name, len(m), mm, mean(m), pm, mean(p), (mm-pm)/pm*100)
		fmt.Fprintf(&report, "OVERHEAD %-30s mount=%v plain=%v\n", "", m, p)
		if b.files != "" {
			rs := strs(overlay(t, id), "readSet")
			total := strings.TrimSpace(dexec(t, fmt.Sprintf("git --git-dir=/var/livemain/mirror.git ls-tree -r --name-only %s | wc -l", head)))
			fmt.Fprintf(&report, "READSET  %-30s %d of %s repo files read: %v\n", b.name, len(rs), total, rs)
		}
	}
	fmt.Print(report.String())
	t.Log("\n" + report.String())
}

func median(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	s := append([]float64(nil), xs...)
	sort.Float64s(s)
	if len(s)%2 == 1 {
		return s[len(s)/2]
	}
	return (s[len(s)/2-1] + s[len(s)/2]) / 2
}

func mean(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	var sum float64
	for _, x := range xs {
		sum += x
	}
	return sum / float64(len(xs))
}

func testRevert(t *testing.T) {
	createWS(t, "reverter", "livefs", mainRemote, v1)
	const concat = "src/functions/text/CONCAT.ts"
	orig := read(t, "reverter", concat)
	// modified file → base content, and no longer an overlay change
	write(t, "reverter", concat, "export default 0;\n")
	must(t, "POST", ws("reverter", "/fs/revert"), J{"path": concat})
	if read(t, "reverter", concat) != orig {
		t.Fatal("revert of a modified file did not restore the base")
	}
	if dexecOK("cmp -s /var/livemain/mnt/reverter/" + concat + " /dev/null") {
		t.Fatal("kernel view still stale after revert")
	}
	// deleted file → restored
	must(t, "POST", ws("reverter", "/fs/delete"), J{"path": concat})
	must(t, "POST", ws("reverter", "/fs/revert"), J{"path": concat})
	if read(t, "reverter", concat) != orig {
		t.Fatal("revert of a deleted file did not restore it")
	}
	// new file → gone
	write(t, "reverter", "src/new.ts", "x\n")
	must(t, "POST", ws("reverter", "/fs/revert"), J{"path": "src/new.ts"})
	mustFail(t, "POST", ws("reverter", "/fs/read"), J{"path": "src/new.ts"}, 404, "not-found")
	if n := len(objs(overlay(t, "reverter"), "changes")); n != 0 {
		t.Fatalf("overlay still has %d changes after reverting everything", n)
	}
	// the kernel mount agrees (external processes see the base)
	if !dexecOK("grep -q CONCAT /var/livemain/mnt/reverter/" + concat) {
		t.Fatal("mount does not show the restored base content")
	}
}

func testSnapshot(t *testing.T) {
	createWS(t, "snapper", "livefs", mainRemote, v1)
	write(t, "snapper", "src/functions/math/MAX.ts", "export default 42;\n")
	first := must(t, "POST", ws("snapper", "/snapshot"), J{"remote": mainRemote})
	if str(first, "ref") != "refs/heads/overlay/snapper" || first["changes"] != float64(1) {
		t.Fatalf("snapshot = %v", first)
	}
	status, body := remoteFile(t, "main", str(first, "sha"), "src/functions/math/MAX.ts")
	if status != 200 || body != "export default 42;\n" {
		t.Fatalf("snapshot content = %d %q", status, body)
	}
	write(t, "snapper", "src/functions/math/MAX.ts", "export default 43;\n")
	second := must(t, "POST", ws("snapper", "/snapshot"), J{"remote": mainRemote})
	// The ref only fast-forwards: the second snapshot has the first as a parent.
	parents := dexec(t, "cd /var/livemain/mirror.git && git rev-list --parents -n 1 "+str(second, "sha"))
	if !strings.Contains(parents, str(first, "sha")) {
		t.Fatalf("second snapshot parents = %s, want the first snapshot %s", parents, str(first, "sha"))
	}
	if _, body := remoteFile(t, "main", "refs/heads/overlay/snapper", "src/functions/math/MAX.ts"); body != "export default 43;\n" {
		t.Fatalf("ref content = %q", body)
	}
	mustFail(t, "POST", ws("snapper", "/snapshot"), J{"remote": mainRemote, "ref": "refs/heads/main"}, 400, "bad-request")
}

func testGenerated(t *testing.T) {
	remote := createRepo(t, "gen")
	s0 := str(must(t, "POST", intURL+"/seed", J{"remote": remote, "dir": "/seed/fixture-repo", "message": "seed"}), "sha")
	// The repo declares its generated files and how to regenerate them.
	createWS(t, "gen-setup", "livefs", remote, s0)
	write(t, "gen-setup", ".gitattributes", "gen/** linguist-generated\n")
	write(t, "gen-setup", "scripts/livemain-regen", "mkdir -p gen && find src/functions -name '*.ts' | sort > gen/functions.txt\n")
	s1 := str(promote(t, "gen-setup", remote, s0, nil), "sha")
	if _, body := remoteFile(t, "gen", s1, "gen/functions.txt"); !strings.Contains(body, "SUM.ts") {
		t.Fatalf("regen did not run on promotion: %q", body)
	}
	// Two agents add functions and both (wrongly) hand-edit the generated file.
	createWS(t, "gen-b", "livefs", remote, s1)
	createWS(t, "gen-c", "livefs", remote, s1)
	write(t, "gen-b", "src/functions/math/MAX.ts", "export default 1;\n")
	write(t, "gen-b", "gen/functions.txt", "hand edit B\n")
	write(t, "gen-c", "src/functions/math/MIN.ts", "export default 2;\n")
	write(t, "gen-c", "gen/functions.txt", "hand edit C\n")
	s2 := str(promote(t, "gen-b", remote, s1, nil), "sha")
	// C's pin is behind; the generated file changed on main, yet this is not a conflict:
	// main's version is taken and regeneration reflects both agents' sources.
	res := promote(t, "gen-c", remote, s2, nil)
	_, body := remoteFile(t, "gen", str(res, "sha"), "gen/functions.txt")
	for _, want := range []string{"MAX.ts", "MIN.ts", "SUM.ts"} {
		if !strings.Contains(body, want) {
			t.Fatalf("regenerated file missing %s: %q", want, body)
		}
	}
	if strings.Contains(body, "hand edit") {
		t.Fatalf("hand edit survived regeneration: %q", body)
	}
	foundRegen := false
	for _, m := range objs(res, "merged") {
		if str(m, "path") == "gen/functions.txt" && str(m, "method") == "regenerate" {
			foundRegen = true
		}
	}
	if !foundRegen {
		t.Fatalf("merged = %v, want gen/functions.txt via regenerate", res["merged"])
	}
	// Checkpoint: a stale overlay's copy of a generated file is replaced by main's.
	cp := checkpoint(t, "gen-c", str(res, "sha"))
	for _, n := range objs(cp, "notices") {
		if str(n, "path") == "gen/functions.txt" && str(n, "mergeMethod") != "regenerate" {
			t.Fatalf("checkpoint notice for generated file = %v", n)
		}
	}
}

func testIsolatedUID(t *testing.T) {
	createWS(t, "uid-a", "livefs", mainRemote, v1)
	createWS(t, "uid-b", "livefs", mainRemote, v1)
	probe := "import { expect, it } from 'vitest';\nimport { writeFileSync } from 'node:fs';\n" +
		"it('runs unprivileged', () => {\n  expect(process.getuid?.()).not.toBe(0);\n" +
		"  expect(() => writeFileSync('/var/livemain/upper/uid-b/escape.txt', 'x')).toThrow();\n});\n"
	write(t, "uid-a", "tests/core/uid.test.ts", probe)
	res := must(t, "POST", ws("uid-a", "/test"), J{"files": []string{"tests/core/uid.test.ts"}})
	if res["ok"] != true {
		t.Fatalf("isolated test run failed: %v", res["output"])
	}
	if dexecOK("test -e /var/livemain/upper/uid-b/escape.txt") {
		t.Fatal("a workspace's tests wrote into another workspace's overlay")
	}
}
