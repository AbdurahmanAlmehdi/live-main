package gitstore

import (
	"container/list"
	"sync"
)

// blobCache is a byte-bounded LRU of immutable blob contents keyed by sha.
// Cached slices are shared: callers must never mutate them.
type blobCache struct {
	mu    sync.Mutex
	max   int
	size  int
	lru   *list.List // of *blobItem
	items map[string]*list.Element
}

type blobItem struct {
	sha  string
	data []byte
}

func newBlobCache(max int) *blobCache {
	return &blobCache{max: max, lru: list.New(), items: make(map[string]*list.Element)}
}

func (c *blobCache) get(sha string) ([]byte, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if e, ok := c.items[sha]; ok {
		c.lru.MoveToFront(e)
		return e.Value.(*blobItem).data, true
	}
	return nil, false
}

func (c *blobCache) put(sha string, data []byte) {
	if len(data) > c.max/8 {
		return // don't let one huge blob flush the cache
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, ok := c.items[sha]; ok {
		return
	}
	c.items[sha] = c.lru.PushFront(&blobItem{sha: sha, data: data})
	c.size += len(data)
	for c.size > c.max {
		e := c.lru.Back()
		it := e.Value.(*blobItem)
		c.lru.Remove(e)
		delete(c.items, it.sha)
		c.size -= len(it.data)
	}
}
