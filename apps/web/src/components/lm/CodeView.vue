<script setup lang="ts">
import type { FileView, MarginNote } from '@livemain/protocol';
import { computed, nextTick, ref, watch } from 'vue';
import { agentName, workerText } from '@/lib/format';
import { highlightLine, langOf } from '@/lib/highlight';
import ChangeTag from './ChangeTag.vue';
import StatusChip from './StatusChip.vue';

/**
 * Main is the page; each agent's pending change is a note in the margin beside the line it
 * will land on (direction C2). Code never animates; notes stack without overlapping.
 */
const props = withDefaults(defineProps<{ file: FileView; agentLink: (id: string) => string; showMargin?: boolean }>(), { showMargin: true });

const ROW = 22;
const lines = computed(() => {
  const text = props.file.content.endsWith('\n') ? props.file.content.slice(0, -1) : props.file.content;
  const lang = langOf(props.file.path);
  return text === '' ? [] : text.split('\n').map((l) => highlightLine(l, lang));
});

/** Main's line a note anchors to: the first changed line of its hunk (insertions: the line after). */
function anchor(n: MarginNote): number {
  let old = n.hunk.oldStart;
  for (const l of n.hunk.lines) {
    if (l.kind !== 'ctx') return Math.max(1, l.kind === 'del' ? (l.old ?? old) : old);
    old = (l.old ?? old) + 1;
  }
  return Math.max(1, n.hunk.oldStart);
}

/** Lines of main a note touches, for the gutter marker. */
const marked = computed(() => {
  const set = new Set<number>();
  for (const n of props.file.notes) {
    let old = n.hunk.oldStart;
    for (const l of n.hunk.lines) {
      if (l.kind === 'del' && l.old) set.add(l.old);
      if (l.kind === 'add') set.add(Math.max(1, old));
      if (l.old) old = l.old + 1;
    }
  }
  return set;
});

function excerpt(n: MarginNote) {
  const lang = langOf(props.file.path);
  return n.hunk.lines.filter((l) => l.kind !== 'ctx').slice(0, 6).map((l) => ({ kind: l.kind === 'add' ? 'd-add' : 'd-del', sign: l.kind === 'add' ? '+' : '−', html: highlightLine(l.text, lang) }));
}

const noteEls = ref<HTMLElement[]>([]);
const tops = ref<number[]>([]);
async function layout() {
  tops.value = props.file.notes.map((n) => (anchor(n) - 1) * ROW);
  await nextTick();
  let floor = 0;
  tops.value = props.file.notes.map((n, i) => {
    const want = (anchor(n) - 1) * ROW;
    const top = Math.max(want, floor);
    floor = top + (noteEls.value[i]?.offsetHeight ?? 120) + 8;
    return top;
  });
}
watch(() => props.file, layout, { immediate: true });
const marginHeight = computed(() => Math.max(lines.value.length * ROW, (tops.value.at(-1) ?? 0) + 200));
</script>

<template>
  <div class="lm-codepage" :class="{ 'has-margin': showMargin }">
    <!-- eslint-disable vue/no-v-html -- lines are escaped by highlightLine -->
    <div class="lm-code" role="region" :aria-label="`${file.path} on main`">
      <div v-for="(html, i) in lines" :key="i" class="lm-code-row" :class="{ 'is-marked': marked.has(i + 1) }">
        <span class="lm-code-ln">{{ i + 1 }}</span><span class="lm-code-text" v-html="html || ' '" />
      </div>
      <div v-if="lines.length === 0" class="caption muted" style="padding: 12px 16px">This file is new: it exists only in an overlay so far.</div>
    </div>
    <aside v-if="showMargin" class="lm-margin" :style="{ minHeight: `${marginHeight}px` }" aria-label="Pending changes">
      <article v-for="(n, i) in file.notes" :key="`${n.agentId}-${i}`" ref="noteEls" class="lm-note" :style="{ top: `${tops[i] ?? 0}px` }">
        <header class="row-2">
          <StatusChip bare :state="n.state" />
          <RouterLink :to="agentLink(n.agentId)" class="mono-md">{{ agentName(n.agentId) }}</RouterLink>
          <span class="grow" />
          <ChangeTag :change="n.class" />
        </header>
        <RouterLink :to="agentLink(n.agentId)" class="body-strong lm-note-title">{{ n.taskTitle }}</RouterLink>
        <div class="caption muted">{{ workerText(n.worker) }} · lands at line {{ anchor(n) }}</div>
        <div class="lm-excerpt">
          <div v-for="(l, j) in excerpt(n)" :key="j" class="ex" :class="l.kind"><span class="sg">{{ l.sign }}</span><span v-html="l.html" /></div>
        </div>
      </article>
      <p v-if="file.notes.length === 0" class="caption muted lm-margin-empty">No agent is changing this file. Pending changes appear here, beside the line they will land on.</p>
    </aside>
    <!-- eslint-enable vue/no-v-html -->
  </div>
</template>
