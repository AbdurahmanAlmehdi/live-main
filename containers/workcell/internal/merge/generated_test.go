package merge

import "testing"

func TestGeneratedMatcher(t *testing.T) {
	m := GeneratedMatcher([]byte("# generated\nsrc/gen/** linguist-generated\n/schema/*.d.ts linguist-generated=true\n*.png binary\nsrc/hand/** -linguist-generated\n"))
	for p, want := range map[string]bool{
		"package-lock.json":      true,
		"sub/pnpm-lock.yaml":     true,
		"src/gen/a/b.ts":         true,
		"schema/api.d.ts":        true,
		"schema/nested/api.d.ts": false,
		"src/core/registry.ts":   false,
		"src/generated-ish/x.ts": false,
		"img/logo.png":           false,
		"src/hand/a.ts":          false,
	} {
		if got := m(p); got != want {
			t.Errorf("%s: got %v want %v", p, got, want)
		}
	}
	if GeneratedMatcher(nil)("README.md") {
		t.Error("no list: only lockfiles are generated")
	}
}
