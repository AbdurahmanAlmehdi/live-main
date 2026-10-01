//go:build linux

package livefs_test

import "golang.org/x/sys/unix"

func renameat2(from, to string, flags uint) error {
	return unix.Renameat2(unix.AT_FDCWD, from, unix.AT_FDCWD, to, flags)
}
