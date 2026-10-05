<script setup lang="ts">
import type { TaskKindV1, TaskV1 } from '@livemain/protocol';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import CliInline from '@/components/lm/CliInline.vue';
import LmIcon from '@/components/lm/LmIcon.vue';
import SegControl from '@/components/lm/SegControl.vue';
import StateBox from '@/components/lm/StateBox.vue';
import StatusChip from '@/components/lm/StatusChip.vue';
import { api } from '@/lib/api';
import { useRepo } from '@/stores/repo';
import { useToasts } from '@/stores/toasts';

const repo = useRepo();
const toasts = useToasts();
const router = useRouter();
const tasks = ref<TaskV1[] | null>(null);
const filter = ref<'open' | 'active' | 'landed' | 'all'>('open');
const q = ref('');
const selected = ref(new Set<string>());

async function load() {
  tasks.value = await api.tasks(repo.owner, repo.name);
}
onMounted(load);
watch(() => repo.mainTick, () => void load());

const shown = computed(() => {
  const needle = q.value.trim().toLowerCase();
  return (tasks.value ?? []).filter((t) => {
    const f = filter.value === 'all' || (filter.value === 'open' ? t.status === 'open' || t.status === 'failed' : filter.value === 'active' ? t.status === 'queued' || t.status === 'running' : t.status === 'landed');
    return f && (!needle || `${t.id} ${t.title} ${t.labels.join(' ')}`.toLowerCase().includes(needle));
  });
});
const counts = computed(() => {
  const all = tasks.value ?? [];
  return { open: all.filter((t) => t.status === 'open' || t.status === 'failed').length, active: all.filter((t) => t.status === 'queued' || t.status === 'running').length, landed: all.filter((t) => t.status === 'landed').length, all: all.length };
});
const selectable = (t: TaskV1) => t.status === 'open' || t.status === 'failed';
function toggle(t: TaskV1) {
  const next = new Set(selected.value);
  if (next.has(t.id)) next.delete(t.id);
  else next.add(t.id);
  selected.value = next;
}
function selectShown() {
  selected.value = new Set([...selected.value, ...shown.value.filter(selectable).slice(0, 100).map((t) => t.id)]);
}
function dispatch() {
  void router.push({ path: `${repo.base}/dispatch`, query: { tasks: [...selected.value].join(',') } });
}

const STATUS = { open: 'queued', queued: 'queued', running: 'working', landed: 'landed', failed: 'gave-up', cancelled: 'stopped' } as const;

// New task
const adding = ref(false);
const title = ref('');
const prompt = ref('');
const kind = ref<TaskKindV1>('feature');
const tests = ref('');
async function create() {
  const t = await toasts.guard(() => api.createTask(repo.owner, repo.name, { title: title.value, prompt: prompt.value || undefined, kind: kind.value, tests: tests.value.split(/[\s,]+/).filter(Boolean) }), 'Task added.');
  if (!t) return;
  title.value = prompt.value = tests.value = '';
  adding.value = false;
  await load();
}
</script>

<template>
  <main class="lm-page">
    <div class="lm-page-head">
      <h2 class="title">Tasks</h2>
      <SegControl v-model="filter" label="Filter tasks" :options="[{ value: 'open', label: `Open ${counts.open}` }, { value: 'active', label: `Dispatched ${counts.active}` }, { value: 'landed', label: `Landed ${counts.landed}` }, { value: 'all', label: `All ${counts.all}` }]" />
      <input v-model="q" class="lm-input" style="max-width: 240px" placeholder="Filter by name or label" aria-label="Filter tasks" />
      <span class="grow" />
      <CliInline :command="`lm task create ${repo.owner}/${repo.name} &quot;…&quot;`" />
      <button type="button" class="lm-btn is-secondary" @click="adding = !adding"><LmIcon name="plus" />New task</button>
      <button type="button" class="lm-btn is-primary" :disabled="selected.size === 0" @click="dispatch"><LmIcon name="play" />Dispatch {{ selected.size || '' }} selected</button>
    </div>

    <form v-if="adding" class="lm-card" @submit.prevent="create">
      <div class="lm-grid-2">
        <label class="lm-field"><span class="body-strong">Title</span><input v-model="title" class="lm-input" required placeholder="Add a DATEDIF function" /></label>
        <label class="lm-field"><span class="body-strong">Kind</span>
          <span class="lm-selectbox"><select v-model="kind" class="lm-input"><option value="feature">Feature</option><option value="contract">Contract work (shared code)</option><option value="change-order">Change order (jumps the queue)</option></select><LmIcon name="chevron-down" /></span>
        </label>
      </div>
      <label class="lm-field" style="max-width: none"><span class="body-strong">What done looks like</span><textarea v-model="prompt" class="lm-textarea" placeholder="Describe the change for the agent. Mention files and behavior that must keep working." /></label>
      <label class="lm-field"><span class="body-strong">Acceptance tests <span class="muted">(optional)</span></span><input v-model="tests" class="lm-input" placeholder="tests/functions/DATEDIF.test.ts" /><span class="caption muted">Without tests, the agent must get the whole suite green.</span></label>
      <div class="row-2"><button type="submit" class="lm-btn is-primary" :disabled="!title.trim()">Add task</button><button type="button" class="lm-btn is-ghost" @click="adding = false">Cancel</button></div>
    </form>

    <StateBox v-if="tasks === null" kind="loading" title="Loading tasks…" />
    <StateBox v-else-if="shown.length === 0" title="No tasks here" icon="tasks">{{ filter === 'open' ? 'Add a task, or pick from another filter.' : 'Nothing matches this filter.' }}</StateBox>
    <template v-else>
      <div class="row-3"><button type="button" class="lm-btn is-ghost is-sm" @click="selectShown">Select {{ Math.min(100, shown.filter(selectable).length) }} shown</button><button v-if="selected.size" type="button" class="lm-btn is-ghost is-sm" @click="selected = new Set()">Clear selection</button></div>
      <div class="lm-tablewrap">
        <table class="lm-table is-compact">
          <thead><tr><th style="width: 32px"><span class="lm-skip">Select</span></th><th>Task</th><th>Kind</th><th>Status</th><th>Tests</th><th>Labels</th></tr></thead>
          <tbody>
            <tr v-for="t in shown.slice(0, 400)" :key="t.id">
              <td><input type="checkbox" class="lm-check" :checked="selected.has(t.id)" :disabled="!selectable(t)" :aria-label="`Select ${t.title}`" @change="toggle(t)" /></td>
              <td><span class="body-strong">{{ t.title }}</span> <span class="mono-sm muted">{{ t.id }}</span></td>
              <td class="caption">{{ t.kind }}</td>
              <td><StatusChip bare :state="STATUS[t.status]" :label="t.status === 'open' ? 'open' : t.status" /></td>
              <td class="mono-sm muted">{{ t.tests.length ? t.tests.map((x) => x.split('/').pop()).join(', ') : 'whole suite' }}</td>
              <td class="caption muted">{{ t.labels.join(', ') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="shown.length > 400" class="caption muted">Showing 400 of {{ shown.length }}; filter to narrow.</p>
    </template>
  </main>
</template>
