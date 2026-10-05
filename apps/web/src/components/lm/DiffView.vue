<script setup lang="ts">
import type { DiffLine, FilePatch, Hunk } from '@livemain/protocol';
import { computed, ref } from 'vue';
import { highlightLine, langOf } from '@/lib/highlight';
import ChangeTag from './ChangeTag.vue';
import LmIcon from './LmIcon.vue';

/** One file's patch: unified or split, line numbers, word-level highlight on paired lines. */
const props = defineProps<{ patch: FilePatch; layout: 'unified' | 'split'; collapsed?: boolean }>();
const open = ref(!props.collapsed);
const lang = computed(() => langOf(props.patch.path));

/** Word-level emphasis: the differing middle of a removed/added pair. */
function emphasize(a: string, b: string): [string, string] {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const mark = (t: string) => {
    const mid = t.slice(p, t.length - s);
    if (!mid || mid.length === t.length) return highlightLine(t, lang.value);
    return `${highlightLine(t.slice(0, p), lang.value)}<span class="w">${highlightLine(mid, lang.value)}</span>${highlightLine(t.slice(t.length - s), lang.value)}`;
  };
  return [mark(a), mark(b)];
}

interface Row {
  kind: 'ctx' | 'add' | 'del';
  old: number | null;
  new: number | null;
  html: string;
}

function rowsOf(h: Hunk): Row[] {
  const out: Row[] = h.lines.map((l: DiffLine) => ({ kind: l.kind, old: l.old, new: l.new, html: highlightLine(l.text, lang.value) }));
  // Pair consecutive del/add runs for word highlights.
  for (let i = 0; i < h.lines.length; i++) {
    if (h.lines[i]!.kind !== 'del') continue;
    let j = i;
    while (j < h.lines.length && h.lines[j]!.kind === 'del') j++;
    let k = j;
    while (k < h.lines.length && h.lines[k]!.kind === 'add') k++;
    for (let n = 0; n < Math.min(j - i, k - j); n++) {
      const [a, b] = emphasize(h.lines[i + n]!.text, h.lines[j + n]!.text);
      out[i + n]!.html = a;
      out[j + n]!.html = b;
    }
    i = k - 1;
  }
  return out;
}

const hunks = computed(() => props.patch.hunks.map((h) => ({ h, rows: rowsOf(h) })));

/** Split view: deletions on the left, additions on the right, aligned per change block. */
function splitRows(rows: Row[]): { l: Row | null; r: Row | null }[] {
  const out: { l: Row | null; r: Row | null }[] = [];
  for (let i = 0; i < rows.length; ) {
    const row = rows[i]!;
    if (row.kind === 'ctx') {
      out.push({ l: row, r: row });
      i++;
      continue;
    }
    const dels: Row[] = [];
    const adds: Row[] = [];
    while (i < rows.length && rows[i]!.kind === 'del') dels.push(rows[i++]!);
    while (i < rows.length && rows[i]!.kind === 'add') adds.push(rows[i++]!);
    for (let n = 0; n < Math.max(dels.length, adds.length); n++) out.push({ l: dels[n] ?? null, r: adds[n] ?? null });
  }
  return out;
}
const cls = (r: Row | null) => (r === null ? 'd-empty' : r.kind === 'add' ? 'd-add' : r.kind === 'del' ? 'd-del' : '');
const sign = (r: Row | null) => (r === null ? '' : r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' ');
</script>

<template>
  <div class="lm-diff">
    <div class="lm-diffbar">
      <button type="button" class="lm-iconbtn" :aria-expanded="open" :aria-label="`${open ? 'Collapse' : 'Expand'} ${patch.path}`" @click="open = !open">
        <LmIcon :name="open ? 'chevron-down' : 'chevron-right'" />
      </button>
      <span class="mono-sm strong">{{ patch.path }}</span>
      <span v-if="patch.status !== 'modified'" class="caption muted">{{ patch.status === 'added' ? 'new file' : 'deleted' }}</span>
      <ChangeTag :change="patch.class" />
      <span v-if="patch.merged" class="caption muted">merged automatically ({{ patch.merged }})</span>
      <span v-if="patch.against === 'rebased'" class="caption muted">rebased onto main (keeps concurrent landings)</span>
      <span v-else-if="patch.against === 'pin'" class="caption muted">against its pin (conflicts with main)</span>
      <span class="grow" />
      <span class="mono-sm"><span v-if="patch.added" class="add-fg">+{{ patch.added }}</span> <span v-if="patch.removed" class="del-fg">−{{ patch.removed }}</span></span>
    </div>
    <template v-if="open">
      <div v-if="patch.binary" class="caption muted" style="padding: 8px 16px">Binary file</div>
      <!-- eslint-disable vue/no-v-html -- highlighted lines are escaped by highlightLine -->
      <table v-else-if="layout === 'unified'" class="lm-difftable">
        <colgroup><col style="width: 44px" /><col style="width: 44px" /><col style="width: 20px" /><col /></colgroup>
        <tbody v-for="(x, hi) in hunks" :key="hi">
          <tr class="d-hunk"><td colspan="2" /><td colspan="2">{{ x.h.header }}</td></tr>
          <tr v-for="(r, ri) in x.rows" :key="ri" :class="cls(r)">
            <td class="ln">{{ r.old ?? '' }}</td><td class="ln">{{ r.new ?? '' }}</td><td class="sg">{{ sign(r) }}</td><td class="cd" v-html="r.html" />
          </tr>
        </tbody>
      </table>
      <table v-else class="lm-difftable is-split">
        <colgroup><col style="width: 44px" /><col style="width: 20px" /><col /><col style="width: 44px" /><col style="width: 20px" /><col /></colgroup>
        <tbody v-for="(x, hi) in hunks" :key="hi">
          <tr class="d-hunk"><td colspan="6">{{ x.h.header }}</td></tr>
          <tr v-for="(p, pi) in splitRows(x.rows)" :key="pi">
            <td class="ln" :class="cls(p.l)">{{ p.l?.old ?? '' }}</td><td class="sg" :class="cls(p.l)">{{ p.l?.kind === 'del' ? '−' : '' }}</td><td class="cd" :class="cls(p.l)" v-html="p.l?.html ?? ''" />
            <td class="ln" :class="cls(p.r)">{{ p.r?.new ?? '' }}</td><td class="sg" :class="cls(p.r)">{{ p.r?.kind === 'add' ? '+' : '' }}</td><td class="cd" :class="cls(p.r)" v-html="p.r?.html ?? ''" />
          </tr>
        </tbody>
      </table>
      <!-- eslint-enable vue/no-v-html -->
    </template>
  </div>
</template>
