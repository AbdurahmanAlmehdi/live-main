//go:build !linux

package livefs_test

import "syscall"

func renameat2(string, string, uint) error { return syscall.ENOTSUP }
