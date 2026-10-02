package merge

import (
	"path"
	"strings"
)

// GeneratedListPath is where a repo marks generated files, with the standard
// `linguist-generated` attribute (e.g. `src/gen/** linguist-generated`). Generated files
// are never text-merged. Well-known lockfiles are always generated.
const GeneratedListPath = ".gitattributes"

var lockfiles = map[string]bool{
	"package-lock.json": true, "pnpm-lock.yaml": true, "yarn.lock": true, "bun.lockb": true,
	"npm-shrinkwrap.json": true, "go.sum": true, "Cargo.lock": true, "poetry.lock": true, "Gemfile.lock": true,
}

// GeneratedMatcher returns a predicate for generated paths given the content of
// .gitattributes (nil if the repo has none): patterns whose attributes set
// `linguist-generated` (or `linguist-generated=true`). Patterns use path.Match syntax; a
// trailing "/**" matches everything below a directory.
func GeneratedMatcher(gitattributes []byte) func(string) bool {
	var globs []string
	for _, line := range strings.Split(string(gitattributes), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 || strings.HasPrefix(fields[0], "#") {
			continue
		}
		for _, attr := range fields[1:] {
			if attr == "linguist-generated" || attr == "linguist-generated=true" {
				globs = append(globs, strings.TrimPrefix(fields[0], "/"))
				break
			}
		}
	}
	return func(p string) bool {
		if lockfiles[path.Base(p)] {
			return true
		}
		for _, g := range globs {
			if strings.HasSuffix(g, "/**") && strings.HasPrefix(p, strings.TrimSuffix(g, "**")) {
				return true
			}
			if ok, _ := path.Match(g, p); ok {
				return true
			}
		}
		return false
	}
}
