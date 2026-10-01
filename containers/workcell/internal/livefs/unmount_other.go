//go:build !linux

package livefs

import "syscall"

// LazyUnmount detaches a mount even if busy.
func LazyUnmount(dir string) error { return syscall.Unmount(dir, 0) }
