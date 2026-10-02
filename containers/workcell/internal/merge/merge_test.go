package merge

import (
	"context"
	"strings"
	"testing"
)

const registryBase = `import type { FunctionLoader } from './types';
export const registry: Record<string, FunctionLoader> = {
  SUM: () => import('../functions/math/SUM'),
  // functions (one per line, keep this marker as the last line inside the object)
};
`

func addEntry(base, name string) string {
	marker := "  // functions"
	return strings.Replace(base, marker, "  "+name+": () => import('../functions/math/"+name+"'),\n"+marker, 1)
}

func TestUnionBothInsertSameAnchorOursFirst(t *testing.T) {
	ours, theirs := addEntry(registryBase, "MAX"), addEntry(registryBase, "MIN")
	got, ok := Union([]byte(registryBase), []byte(ours), []byte(theirs))
	if !ok {
		t.Fatal("union refused insert-only sides")
	}
	want := addEntry(addEntry(registryBase, "MAX"), "MIN")
	if string(got) != want {
		t.Fatalf("got:\n%s\nwant:\n%s", got, want)
	}
}

func TestUnionDifferentAnchorsAndEnds(t *testing.T) {
	base := "a\nb\nc\n"
	got, ok := Union([]byte(base), []byte("x\na\nb\nc\n"), []byte("a\nb\nc\ny\n"))
	if !ok || string(got) != "x\na\nb\nc\ny\n" {
		t.Fatalf("got %q ok=%v", got, ok)
	}
	// Ours only, theirs unchanged.
	got, ok = Union([]byte(base), []byte("a\nq\nb\nc\n"), []byte(base))
	if !ok || string(got) != "a\nq\nb\nc\n" {
		t.Fatalf("got %q ok=%v", got, ok)
	}
	// Empty base (both sides added the file).
	got, ok = Union(nil, []byte("one\n"), []byte("two\n"))
	if !ok || string(got) != "one\ntwo\n" {
		t.Fatalf("got %q ok=%v", got, ok)
	}
	// Trailing block without newline gets one when more follows.
	got, ok = Union([]byte("a\n"), []byte("a\nx"), []byte("a\ny\n"))
	if !ok || string(got) != "a\nx\ny\n" {
		t.Fatalf("got %q ok=%v", got, ok)
	}
}

func TestUnionIdenticalInsertKeptOnce(t *testing.T) {
	base := "a\nb\n"
	got, ok := Union([]byte(base), []byte("a\nz\nb\n"), []byte("a\nz\nb\n"))
	if !ok || string(got) != "a\nz\nb\n" {
		t.Fatalf("got %q ok=%v", got, ok)
	}
}

func TestUnionRefusesDeletionsAndModifications(t *testing.T) {
	base := "a\nb\nc\n"
	if _, ok := Union([]byte(base), []byte("a\nc\n"), []byte(base+"d\n")); ok {
		t.Fatal("deletion in ours accepted")
	}
	if _, ok := Union([]byte(base), []byte(base), []byte("a\nB\nc\n")); ok {
		t.Fatal("modification in theirs accepted")
	}
}

func TestMergerChainWithoutMergiraf(t *testing.T) {
	ctx := context.Background()
	m := &Merger{} // no mergiraf
	ours, theirs := addEntry(registryBase, "MAX"), addEntry(registryBase, "MIN")
	res, err := m.Merge(ctx, "src/core/registry.ts", []byte(registryBase), []byte(ours), []byte(theirs))
	if err != nil || !res.Clean || res.Method != MethodUnion {
		t.Fatalf("res=%+v err=%v", res, err)
	}

	// Non-overlapping modifications: union refuses, merge-file merges cleanly.
	base := "l1\nl2\nl3\nl4\nl5\nl6\n"
	res, err = m.Merge(ctx, "x.ts", []byte(base), []byte("L1\nl2\nl3\nl4\nl5\nl6\n"), []byte("l1\nl2\nl3\nl4\nl5\nL6\n"))
	if err != nil || !res.Clean || res.Method != MethodMergeFile || string(res.Content) != "L1\nl2\nl3\nl4\nl5\nL6\n" {
		t.Fatalf("res=%+v err=%v", res, err)
	}

	// Overlapping modifications: conflict with markers.
	res, err = m.Merge(ctx, "x.ts", []byte(base), []byte("l1\nOURS\nl3\nl4\nl5\nl6\n"), []byte("l1\nTHEIRS\nl3\nl4\nl5\nl6\n"))
	if err != nil || res.Clean || !HasConflictMarkers(res.Content) {
		t.Fatalf("res=%+v err=%v", res, err)
	}
}

func TestMergiraf(t *testing.T) {
	m := NewMerger("")
	if !m.HasMergiraf() {
		t.Skip("mergiraf not installed")
	}
	ours, theirs := addEntry(registryBase, "MAX"), addEntry(registryBase, "MIN")
	res, err := m.Merge(context.Background(), "src/core/registry.ts", []byte(registryBase), []byte(ours), []byte(theirs))
	if err != nil || !res.Clean {
		t.Fatalf("res=%+v err=%v", res, err)
	}
	if !strings.Contains(string(res.Content), "MAX:") || !strings.Contains(string(res.Content), "MIN:") {
		t.Fatalf("merged content lost an entry:\n%s", res.Content)
	}
}
