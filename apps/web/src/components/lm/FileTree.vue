<script setup lang="ts">
import type { TreeEntry } from '@livemain/protocol';
import { computed, ref, watch } from 'vue';
import LmIcon from './LmIcon.vue';

interface Node {
  entry: TreeEntry;
  depth: number;
  children: Node[];
}

const props = defineProps<{ entries: TreeEntry[]; selected?: string | null; version?: number | null }>();
const emit = defineEmits<{ open: [path: string] }>();

const roots = computed(() => {
  const byPath = new Map<string, Node>();
  const top: Node[] = [];
  const sorted = [...props.entries].sort((a, b) => a.path.localeCompare(b.path));
  for (const e of sorted) {
    const depth = e.path.split('/').length - 1;
    const node: Node = { entry: e, depth, children: [] };
    byPath.set(e.path, node);
    const parent = e.path.includes('/') ? byPath.get(e.path.slice(0, e.path.lastIndexOf('/'))) : undefined;
    (parent ? parent.children : top).push(node);
  }
  const order = (ns: Node[]) => {
    ns.sort((a, b) => (a.entry.type === b.entry.type ? a.entry.name.localeCompare(b.entry.name) : a.entry.type === 'dir' ? -1 : 1));
    ns.forEach((n) => order(n.children));
  };
  order(top);
  return top;
});

const expanded = ref(new Set<string>());
// Open the selected file's folders and any folder agents are writing in.
watch(
  () => [props.selected, props.entries] as const,
  () => {
    const next = new Set(expanded.value);
    if (props.selected) {
      const parts = props.selected.split('/');
      for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join('/'));
    }
    for (const e of props.entries) if (e.type === 'dir' && e.writers > 0) next.add(e.path);
    expanded.value = next;
  },
  { immediate: true },
);

const rows = computed(() => {
  const out: Node[] = [];
  const walk = (ns: Node[]) => {
    for (const n of ns) {
      out.push(n);
      if (n.entry.type === 'dir' && expanded.value.has(n.entry.path)) walk(n.children);
    }
  };
  walk(roots.value);
  return out;
});
const files = computed(() => props.entries.filter((e) => e.type === 'file').length);

function click(n: Node) {
  if (n.entry.type === 'dir') {
    const next = new Set(expanded.value);
    if (next.has(n.entry.path)) next.delete(n.entry.path);
    else next.add(n.entry.path);
    expanded.value = next;
  } else emit('open', n.entry.path);
}

function title(e: TreeEntry): string | undefined {
  const parts: string[] = [];
  if (e.writers) parts.push(e.type === 'dir' ? `${e.writers} agent${e.writers === 1 ? ' is' : 's are'} changing files in here` : `${e.writers} agent${e.writers === 1 ? ' is' : 's are'} changing this file`);
  if (e.readers && e.type === 'file') parts.push(`${e.readers} ha${e.readers === 1 ? 's' : 've'} read it`);
  if (e.size === null && e.type === 'file') parts.push('new, exists only in an overlay');
  return parts.join(' · ') || undefined;
}
</script>

<template>
  <nav class="lm-tree" aria-label="Files">
    <div class="lm-tree-head"><span>main <span v-if="version" class="mono-sm strong">v{{ version }}</span> · {{ files }} files</span></div>
    <button
      v-for="n in rows"
      :key="n.entry.path"
      type="button"
      class="lm-treerow"
      :class="{ 'is-selected': n.entry.path === selected, 'is-ghost': n.entry.size === null && n.entry.type === 'file' }"
      :style="{ paddingLeft: `${8 + n.depth * 14}px` }"
      :title="title(n.entry)"
      :aria-current="n.entry.path === selected ? 'true' : undefined"
      :aria-expanded="n.entry.type === 'dir' ? expanded.has(n.entry.path) : undefined"
      @click="click(n)"
    >
      <span class="caret"><LmIcon v-if="n.entry.type === 'dir'" :name="expanded.has(n.entry.path) ? 'chevron-down' : 'chevron-right'" :size="12" /></span>
      <span class="name" :class="{ 'is-dir': n.entry.type === 'dir' }">{{ n.entry.name }}</span>
      <span v-if="n.entry.size === null && n.entry.type === 'file'" class="caption muted">new</span>
      <span v-if="n.entry.writers" class="mk-w" :aria-label="`written by ${n.entry.writers}`"><LmIcon name="written" :size="12" />{{ n.entry.writers }}</span>
      <span v-if="n.entry.readers && n.entry.type === 'file'" class="mk-r" :aria-label="`read by ${n.entry.readers}`"><LmIcon name="read" :size="12" />{{ n.entry.readers }}</span>
    </button>
    <div class="lm-tree-legend caption muted">
      <span class="mk-w"><LmIcon name="written" :size="12" />writing</span><span class="mk-r"><LmIcon name="read" :size="12" />read</span>
    </div>
  </nav>
</template>
