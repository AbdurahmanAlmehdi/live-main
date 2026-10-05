<script setup lang="ts">
import { PROVIDERS, type KeyInfo, type ModelRule, type ProviderId, type Worker } from '@livemain/protocol';
import { computed } from 'vue';
import LmIcon from './LmIcon.vue';

/** Which worker takes which kind of task. The first matching rule wins. */
const props = defineProps<{ keys: KeyInfo[]; allowReplay: boolean; removable: boolean; index: number }>();
const rule = defineModel<ModelRule>({ required: true });
defineEmits<{ remove: [] }>();

const WHEN: { value: ModelRule['when']; label: string }[] = [
  { value: 'default', label: 'any task' },
  { value: 'feature', label: 'task is a feature' },
  { value: 'contract', label: 'contract work' },
  { value: 'change-order', label: 'change order' },
];

const when = computed({
  get: () => rule.value.when,
  set: (w: ModelRule['when']) => (rule.value = { ...rule.value, when: w }),
});

type WorkerChoice = ProviderId | 'scripted' | 'claude-code';
const choice = computed<WorkerChoice>({
  get: () => (rule.value.worker.kind === 'model' ? rule.value.worker.provider : rule.value.worker.kind === 'external' ? 'claude-code' : 'scripted'),
  set: (v) => {
    const worker: Worker = v === 'scripted' ? { kind: 'scripted' } : v === 'claude-code' ? { kind: 'external', name: 'Claude Code' } : { kind: 'model', provider: v, model: defaultModel(v) };
    rule.value = { ...rule.value, worker };
  },
});
const note = computed(() => {
  const w = rule.value.worker;
  if (w.kind === 'scripted') return 'replays the template’s reference solutions; no model tokens';
  if (w.kind === 'external') return 'tasks wait for Claude Code agents to claim them (lm mcp); they run on your Claude Code plan';
  return `uses your ${PROVIDERS[w.provider].label} key`;
});
const model = computed({
  get: () => (rule.value.worker.kind === 'model' ? rule.value.worker.model : ''),
  set: (m: string) => {
    if (rule.value.worker.kind === 'model') rule.value = { ...rule.value, worker: { ...rule.value.worker, model: m } };
  },
});
function defaultModel(p: ProviderId): string {
  if (p === 'anthropic') return 'claude-haiku-4-5';
  return props.keys.find((k) => k.provider === p)?.test?.models[0] ?? '';
}
const models = computed(() => (rule.value.worker.kind === 'model' ? (props.keys.find((k) => k.provider === (rule.value.worker as { provider: ProviderId }).provider)?.test?.models ?? []) : []));
const listId = computed(() => `models-${props.index}`);
</script>

<template>
  <li class="lm-mix">
    <label class="mx-when">
      <span class="caption-strong muted">WHEN</span>
      <span class="lm-selectbox"><select v-model="when" class="lm-input" aria-label="When"><option v-for="w in WHEN" :key="w.value" :value="w.value">{{ w.label }}</option></select><LmIcon name="chevron-down" /></span>
    </label>
    <span class="muted">→</span>
    <span class="row-2" style="flex-wrap: nowrap; min-width: 0">
      <span class="lm-selectbox" style="flex: 0 0 160px">
        <select v-model="choice" class="lm-input" aria-label="Worker">
          <option v-for="k in keys" :key="k.provider" :value="k.provider">{{ PROVIDERS[k.provider].label }}</option>
          <option value="claude-code">Claude Code (via lm mcp)</option>
          <option v-if="allowReplay" value="scripted">Replay (reference solutions)</option>
        </select>
        <LmIcon name="chevron-down" />
      </span>
      <template v-if="rule.worker.kind === 'model'">
        <input v-model="model" class="lm-input" :list="listId" placeholder="model id" aria-label="Model" />
        <datalist :id="listId"><option v-for="m in models" :key="m" :value="m" /></datalist>
      </template>
    </span>
    <span />
    <span class="caption muted mx-note">{{ note }}</span>
    <button v-if="removable" type="button" class="lm-iconbtn" aria-label="Remove rule" title="Remove rule" @click="$emit('remove')"><LmIcon name="close" /></button>
    <span v-else />
  </li>
</template>
