// Package merge implements the three-way merge chain used by checkpoint and
// /integrate: mergiraf (syntax-aware) → additive union → git merge-file.
package merge

import (
	"bytes"
	"strings"
)

// SplitLines splits s into lines, each keeping its trailing "\n" (the last
// line may lack one).
func SplitLines(s []byte) []string {
	if len(s) == 0 {
		return nil
	}
	var out []string
	for len(s) > 0 {
		i := bytes.IndexByte(s, '\n')
		if i < 0 {
			out = append(out, string(s))
			break
		}
		out = append(out, string(s[:i+1]))
		s = s[i+1:]
	}
	return out
}

// insertions returns, for a side that only inserts lines relative to base,
// the inserted blocks keyed by anchor: anchor i means "before base line i"
// (i == len(base) means at the end). ok=false if the side deletes or
// modifies any base line (i.e. base is not a subsequence of side).
//
// Base lines are matched greedily to their earliest occurrence, which is
// exact for the subsequence test and anchors each insertion to the base line
// that follows it.
func insertions(base, side []string) (map[int][]string, bool) {
	ins := make(map[int][]string)
	j := 0
	for i, line := range base {
		start := j
		for j < len(side) && side[j] != line {
			j++
		}
		if j == len(side) {
			return nil, false
		}
		if j > start {
			ins[i] = side[start:j]
		}
		j++
	}
	if j < len(side) {
		ins[len(base)] = side[j:]
	}
	return ins, true
}

// Union merges two sides that each only insert lines relative to base.
// Insertions at the same anchor are emitted ours first, then theirs (an
// identical block inserted by both sides is kept once). ok=false when either
// side deletes or modifies a base line.
func Union(base, ours, theirs []byte) ([]byte, bool) {
	b := SplitLines(base)
	insO, ok := insertions(b, SplitLines(ours))
	if !ok {
		return nil, false
	}
	insT, ok := insertions(b, SplitLines(theirs))
	if !ok {
		return nil, false
	}
	var out []string
	emit := func(block []string) {
		if len(block) == 0 {
			return
		}
		// A block that ended a file without a newline gets one when more follows.
		if n := len(out); n > 0 && !strings.HasSuffix(out[n-1], "\n") {
			out[n-1] += "\n"
		}
		out = append(out, block...)
	}
	for i := 0; i <= len(b); i++ {
		o, t := insO[i], insT[i]
		emit(o)
		if !equalLines(o, t) {
			emit(t)
		}
		if i < len(b) {
			emit([]string{b[i]})
		}
	}
	return []byte(strings.Join(out, "")), true
}

func equalLines(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
