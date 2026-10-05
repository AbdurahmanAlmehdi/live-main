<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { IconName } from '@/lib/icons';
import LmIcon from './LmIcon.vue';

export interface Command {
  group: string;
  label: string;
  icon: IconName;
  hint?: string;
  run: string | (() => void);
}

/** ⌘K from anywhere: jump to a repo, a tab, an agent; dispatch. */
const props = defineProps<{ commands: Command[] }>();
const open = defineModel<boolean>({ required: true });
const router = useRouter();
const q = ref('');
const active = ref(0);
const input = ref<HTMLInputElement | null>(null);

const results = computed(() => {
  const needle = q.value.trim().toLowerCase();
  return props.commands.filter((c) => !needle || `${c.group} ${c.label} ${c.hint ?? ''}`.toLowerCase().includes(needle)).slice(0, 12);
});
watch(open, async (v) => {
  if (!v) return;
  q.value = '';
  active.value = 0;
  await nextTick();
  input.value?.focus();
});
watch(q, () => (active.value = 0));

function run(c: Command | undefined) {
  if (!c) return;
  open.value = false;
  if (typeof c.run === 'string') void router.push(c.run);
  else c.run();
}
function key(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') active.value = Math.min(results.value.length - 1, active.value + 1);
  else if (e.key === 'ArrowUp') active.value = Math.max(0, active.value - 1);
  else if (e.key === 'Enter') run(results.value[active.value]);
  else if (e.key === 'Escape') open.value = false;
  else return;
  e.preventDefault();
}
</script>

<template>
  <div v-if="open" class="lm-scrim" @click.self="open = false">
    <div class="lm-palette" role="dialog" aria-label="Command palette">
      <div class="pal-input"><LmIcon name="search" /><input ref="input" v-model="q" class="pal-q" placeholder="Jump to a repo, tab or agent…" aria-label="Search commands" @keydown="key" /><kbd class="lm-kbd">esc</kbd></div>
      <template v-for="(c, i) in results" :key="`${c.group}-${c.label}`">
        <div v-if="i === 0 || results[i - 1]!.group !== c.group" class="pal-group caption-strong muted">{{ c.group.toUpperCase() }}</div>
        <button type="button" class="pal-item" :class="{ 'is-active': i === active }" style="border: 0; background: none; width: 100%; text-align: left; cursor: pointer" @mouseenter="active = i" @click="run(c)">
          <LmIcon :name="c.icon" /><span class="body">{{ c.label }}</span><span class="grow" /><span v-if="c.hint" class="caption muted">{{ c.hint }}</span>
        </button>
      </template>
      <div v-if="results.length === 0" class="pal-item caption muted">Nothing matches “{{ q }}”.</div>
      <div class="pal-foot caption muted"><span><kbd class="lm-kbd">↑</kbd><kbd class="lm-kbd">↓</kbd> move</span><span><kbd class="lm-kbd">↵</kbd> open</span></div>
    </div>
  </div>
</template>
