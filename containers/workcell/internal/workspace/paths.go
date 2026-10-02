package workspace

import (
	"path"
	"regexp"
	"strings"

	"livemain/workcell/internal/apierr"
)

var idRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)

// ValidID checks a workspace id.
func ValidID(id string) error {
	if !idRe.MatchString(id) {
		return apierr.BadRequest("invalid workspace id %q (want [A-Za-z0-9._-], max 128)", id)
	}
	return nil
}

// CleanPath validates a repo-relative path: forward slashes, no leading
// "/", no "." or ".." segments, no NUL. allowEmpty permits "" (the root).
func CleanPath(p string, allowEmpty bool) (string, error) {
	p = strings.TrimSuffix(p, "/")
	if p == "" || p == "." {
		if allowEmpty {
			return "", nil
		}
		return "", apierr.BadRequest("path is required")
	}
	if strings.HasPrefix(p, "/") || strings.ContainsRune(p, 0) || strings.Contains(p, "\\") {
		return "", apierr.BadRequest("invalid path %q: must be repo-relative with forward slashes", p)
	}
	for _, seg := range strings.Split(p, "/") {
		if seg == "" || seg == "." || seg == ".." {
			return "", apierr.BadRequest("invalid path %q", p)
		}
	}
	return path.Clean(p), nil
}

// excludedName reports directory names never listed or searched.
func excludedName(name string) bool {
	return name == "node_modules" || name == ".git" || name == ".livemain"
}

// reservedWrite reports paths agents may not write.
func reservedWrite(p string) bool {
	first, _, _ := strings.Cut(p, "/")
	if first == ".livemain" {
		return true
	}
	for _, seg := range strings.Split(p, "/") {
		if seg == "node_modules" || seg == ".git" {
			return true
		}
	}
	return false
}
