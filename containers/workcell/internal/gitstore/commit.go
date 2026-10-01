package gitstore

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
)

// CommitChanges writes a commit on top of parent in the mirror, setting each path in
// final to its content (nil = delete), using a temporary index and no working tree.
// It returns parent unchanged when the resulting tree equals parent's tree.
// author and committer are "Name <email>". extraParents are added after parent
// (e.g. a previous snapshot), and force a new commit even if the tree is unchanged.
func (m *Mirror) CommitChanges(ctx context.Context, parent string, parentIdx *TreeIndex, final map[string]*string, message, author, committer string, extraParents ...string) (string, error) {
	tmp, err := os.CreateTemp("", "livemain-index-*")
	if err != nil {
		return "", err
	}
	tmp.Close()
	os.Remove(tmp.Name()) // git wants to create it
	defer os.Remove(tmp.Name())
	env := []string{"GIT_INDEX_FILE=" + tmp.Name()}
	git := func(stdin io.Reader, args ...string) (string, error) {
		out, err := Run(ctx, Cmd{Dir: m.Dir, Env: env, Stdin: stdin, Args: args})
		return strings.TrimSpace(string(out)), err
	}
	if _, err := git(nil, "read-tree", parent); err != nil {
		return "", err
	}
	paths := make([]string, 0, len(final))
	for p := range final {
		paths = append(paths, p)
	}
	sort.Strings(paths)
	var info bytes.Buffer
	for _, p := range paths {
		content := final[p]
		if content == nil {
			if _, ok := parentIdx.Lookup(p); ok {
				fmt.Fprintf(&info, "0 %s\t%s\n", strings.Repeat("0", 40), p)
			}
			continue
		}
		sha, err := m.HashObject(ctx, []byte(*content))
		if err != nil {
			return "", err
		}
		mode := uint32(ModeFile)
		if e, ok := parentIdx.Lookup(p); ok && e.IsRegular() {
			mode = e.Mode
		}
		fmt.Fprintf(&info, "%o %s\t%s\n", mode, sha, p)
	}
	if info.Len() > 0 {
		if _, err := git(&info, "update-index", "--index-info"); err != nil {
			return "", err
		}
	}
	tree, err := git(nil, "write-tree")
	if err != nil {
		return "", err
	}
	parentTree, err := m.Git(ctx, "rev-parse", parent+"^{tree}")
	if err != nil {
		return "", err
	}
	if tree == parentTree && len(extraParents) == 0 {
		return parent, nil
	}
	aName, aEmail := ParseAuthor(author)
	cName, cEmail := ParseAuthor(committer)
	cenv := []string{
		"GIT_AUTHOR_NAME=" + aName, "GIT_AUTHOR_EMAIL=" + aEmail,
		"GIT_COMMITTER_NAME=" + cName, "GIT_COMMITTER_EMAIL=" + cEmail,
	}
	args := []string{"commit-tree", tree, "-p", parent}
	for _, p := range extraParents {
		args = append(args, "-p", p)
	}
	out, err := Run(ctx, Cmd{Dir: m.Dir, Env: cenv, Stdin: strings.NewReader(message), Args: args})
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}
