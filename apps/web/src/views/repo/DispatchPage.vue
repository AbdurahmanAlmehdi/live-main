<script setup lang="ts">
import type { DispatchEstimate, DispatchRequest, ModelRule, TaskV1 } from '@livemain/protocol';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CliBlock from '@/components/lm/CliBlock.vue';
import LmIcon from '@/components/lm/LmIcon.vue';
import ModelMixRow from '@/components/lm/ModelMixRow.vue';
import StateBox from '@/components/lm/StateBox.vue';
import { api } from '@/lib/api';
import { duration, plural, usd } from '@/lib/format';
import { useRepo } from '@/stores/repo';
import { useSession } from '@/stores/session';
import { useToasts } from '@/stores/toasts';

const repo = useRepo();
const session = useSession();
const toasts = useToasts();
const route = useRoute();
const router = useRouter();

const tasks = ref<TaskV1[] | null>(null);
const selected = ref(new Set<string>(typeof route.query.tasks === 'string' && route.query.tasks ? route.query.tasks.split(',') : []));
const q = ref('');
const newTasks = ref('');
const name = ref('');
const concurrency = ref(8);
const maxUsd = ref<number | null>(null);
const maxMinutes = ref<number | null>(null);
const rules = ref<ModelRule[]>([]);
const estimate = ref<DispatchEstimate | null>(null);
const estimateError = ref<string | null>(null);
const launching = ref(false);

const replay = computed(() => !!repo.repo?.template && (session.templates.find((t) => t.id === repo.repo?.template)?.scripted ?? false));
const keys = computed(() => (session.keys ?? []).filter((k) => k.test?.ok !== false));

onMounted(async () => {
  await Promise.all([session.loadKeys(), (async () => (tasks.value = await api.tasks(repo.owner, repo.name)))()]);
  const first = keys.value[0];
  rules.value = [{ when: 'default', worker: first ? { kind: 'model', provider: first.provider, model: first.provider === 'anthropic' ? 'claude-haiku-4-5' : (first.test?.models[0] ?? '') } : { kind: 'scripted' } }];
  if (!first && !replay.value) rules.value = [];
});

const open = computed(() => (tasks.value ?? []).filter((t) => t.status === 'open' || t.status === 'failed'));
const shown = computed(() => {
  const n = q.value.trim().toLowerCase();
  return open.value.filter((t) => !n || `${t.id} ${t.title} ${t.labels.join(' ')}`.toLowerCase().includes(n)).slice(0, 200);
});
const typed = computed(() => newTasks.value.split('\n').map((l) => l.trim()).filter(Boolean));
const total = computed(() => selected.value.size + typed.value.length);

function toggle(id: string) {
  const next = new Set(selected.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selected.value = next;
}
function pickFirst(n: number) {
  selected.value = new Set([...selected.value, ...shown.value.slice(0, n).map((t) => t.id)]);
}

const request = computed<DispatchRequest>(() => ({
  name: name.value.trim() || undefined,
  taskIds: [...selected.value],
  newTasks: typed.value.map((title) => ({ title })),
  concurrency: concurrency.value,
  rules: rules.value,
  budget: { maxUsd: maxUsd.value || null, maxMinutes: maxMinutes.value || null },
}));

let timer: ReturnType<typeof setTimeout> | null = null;
watch(
  request,
  (req) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      if (req.rules.length === 0) return;
      try {
        estimate.value = await api.estimate(repo.owner, repo.name, { ...req, newTasks: [] });
        estimateError.value = null;
      } catch (err) {
        estimateError.value = err instanceof Error ? err.message : String(err);
      }
    }, 300);
  },
  { deep: true, immediate: true },
);

const problems = computed(() => {
  const out: string[] = [];
  if (total.value === 0) out.push('Pick at least one task.');
  if (rules.value.length === 0) out.push('Add a model key first, or use a template with reference solutions.');
  if (rules.value.some((r) => r.worker.kind === 'model' && !r.worker.model)) out.push('Choose a model for every rule.');
  if (estimate.value?.missingKeys.length) out.push(`Add a key for ${estimate.value.missingKeys.join(', ')}.`);
  return out;
});

const cli = computed(() => {
  const r = request.value;
  const w = r.rules[0]?.worker;
  const worker = !w ? 'claude-code' : w.kind === 'model' ? `${w.provider}:${w.model}` : w.kind === 'scripted' ? 'scripted' : 'claude-code';
  return [`lm swarm dispatch ${repo.owner}/${repo.name}`, `--tasks ${[...selected.value].slice(0, 3).join(',')}${selected.value.size > 3 ? ',…' : ''}`, `--worker ${worker}`, `--concurrency ${r.concurrency}`].join(' \\\n    ');
});

async function launch() {
  launching.value = true;
  const s = await toasts.guard(() => api.dispatch(repo.owner, repo.name, request.value));
  launching.value = false;
  if (!s) return;
  repo.upsertSwarm(s);
  toasts.push(`${s.name}: ${plural(s.counts.total, 'task')} dispatched.`);
  void router.push(`${repo.base}/swarms/${s.id}`);
}
</script>

<template>
  <main class="lm-page">
    <div class="lm-page-head"><h2 class="title">Dispatch a swarm</h2><span class="caption muted">Agents each get an overlay on main. They land when their tests pass and nothing already on main breaks.</span></div>
    <StateBox v-if="tasks === null" kind="loading" title="Loading tasks…" />
    <div v-else class="lm-split">
      <div class="stack-4">
        <section class="lm-card" aria-labelledby="d-tasks">
          <div class="row-3"><h3 id="d-tasks" class="title-sm">Tasks</h3><span class="caption muted">{{ plural(total, 'task') }} selected · dependencies come along automatically</span></div>
          <div class="row-2">
            <input v-model="q" class="lm-input" style="max-width: 280px" placeholder="Filter open tasks" aria-label="Filter open tasks" />
            <button type="button" class="lm-btn is-ghost is-sm" @click="pickFirst(10)">+ first 10</button>
            <button type="button" class="lm-btn is-ghost is-sm" @click="pickFirst(40)">+ first 40</button>
            <button v-if="selected.size" type="button" class="lm-btn is-ghost is-sm" @click="selected = new Set()">Clear</button>
          </div>
          <div class="lm-tablewrap" style="max-height: 320px; overflow: auto">
            <table class="lm-table is-compact">
              <tbody>
                <tr v-for="t in shown" :key="t.id">
                  <td style="width: 32px"><input type="checkbox" :checked="selected.has(t.id)" :aria-label="`Select ${t.title}`" @change="toggle(t.id)" /></td>
                  <td><span class="body-strong">{{ t.title }}</span> <span class="mono-sm muted">{{ t.id }}</span></td>
                  <td class="caption muted">{{ t.kind }}</td>
                </tr>
                <tr v-if="shown.length === 0"><td colspan="3" class="caption muted">No open tasks{{ q ? ' match' : '' }}.</td></tr>
              </tbody>
            </table>
          </div>
          <label class="lm-field" style="max-width: none">
            <span class="body-strong">New tasks <span class="muted">(one per line)</span></span>
            <textarea v-model="newTasks" class="lm-textarea" style="min-height: 72px" placeholder="Add a DATEDIF function&#10;Support array arguments in SUMPRODUCT" />
          </label>
        </section>

        <section class="lm-card" aria-labelledby="d-mix">
          <div class="row-3"><h3 id="d-mix" class="title-sm">Workers</h3><span class="caption muted">Which model does which kind of task; the first matching rule wins.</span></div>
          <ol v-if="rules.length" class="lm-mixlist">
            <ModelMixRow v-for="(r, i) in rules" :key="i" v-model="rules[i]!" :index="i" :keys="keys" :allow-replay="replay" :removable="rules.length > 1" @remove="rules.splice(i, 1)" />
          </ol>
          <div v-else class="body muted">No model keys yet. <RouterLink to="/settings/keys">Add a key</RouterLink> to dispatch agents on this repository.</div>
          <div class="row-2">
            <button v-if="rules.length" type="button" class="lm-btn is-secondary is-sm" @click="rules.push({ when: 'change-order', worker: { ...rules[0]!.worker } })"><LmIcon name="plus" :size="14" />Add rule</button>
            <span class="caption muted">External agents (Claude Code, Codex) join through <code class="mono-sm">lm mcp</code>, which is not available yet.</span>
          </div>
        </section>

        <section class="lm-card" aria-labelledby="d-limits">
          <h3 id="d-limits" class="title-sm">Concurrency and budget</h3>
          <div class="row-3 wrap">
            <label class="lm-field"><span class="body-strong">Agents at once</span>
              <span class="lm-stepper"><button type="button" class="lm-iconbtn" aria-label="Fewer agents" @click="concurrency = Math.max(1, concurrency - 1)">−</button><span class="numeric">{{ concurrency }}</span><button type="button" class="lm-iconbtn" aria-label="More agents" @click="concurrency = Math.min(100, concurrency + 1)">+</button></span>
            </label>
            <label class="lm-field"><span class="body-strong">Budget cap</span><span class="lm-affix"><span class="muted">$</span><input v-model.number="maxUsd" class="lm-input" type="number" min="0" step="1" placeholder="none" /></span></label>
            <label class="lm-field"><span class="body-strong">Time cap</span><span class="lm-affix"><input v-model.number="maxMinutes" class="lm-input" type="number" min="0" step="5" placeholder="none" /><span class="muted">min</span></span></label>
          </div>
          <span class="caption muted">At a cap the swarm pauses: no new agents start, running ones finish. Raise the cap to continue.</span>
          <label class="lm-field"><span class="body-strong">Name <span class="muted">(optional)</span></span><input v-model="name" class="lm-input" :placeholder="`Swarm of ${plural(total, 'task')}`" /></label>
        </section>
      </div>

      <aside class="stack-4" style="position: sticky; top: 64px">
        <section class="lm-card" aria-labelledby="d-est">
          <h3 id="d-est" class="title-sm">Before you launch</h3>
          <template v-if="estimate">
            <div class="lm-facts">
              <div><span class="caption-strong muted">TASKS</span><span class="numeric-live">{{ estimate.tasks + typed.length }}</span></div>
              <div><span class="caption-strong muted">EST. COST</span><span class="numeric-live">{{ rules.every((r) => r.worker.kind !== 'model') ? '$0' : `${usd(estimate.usdLow)}–${usd(estimate.usdHigh)}` }}</span></div>
              <div><span class="caption-strong muted">EST. TIME</span><span class="numeric-live">{{ duration(estimate.minutes * 60_000) }}</span></div>
            </div>
            <span class="caption muted">{{ rules.every((r) => r.worker.kind !== 'model') ? 'Replay and Claude Code workers use none of your model keys.' : 'From this repository’s history (or a default) per task; prices for non-Anthropic models are not tracked yet.' }}</span>
          </template>
          <p v-else-if="estimateError" class="lm-error-text">{{ estimateError }}</p>
          <ul v-if="problems.length" class="stack-2" style="margin: 0; padding-left: 18px">
            <li v-for="p in problems" :key="p" class="caption" style="color: var(--lm-color-status-attention-fg)">{{ p }}</li>
          </ul>
          <button type="button" class="lm-btn is-primary is-lg" :disabled="launching || problems.length > 0" @click="launch"><LmIcon name="play" />{{ launching ? 'Launching…' : `Launch ${plural(total, 'task')}` }}</button>
        </section>
        <CliBlock label="Same dispatch from the CLI" :command="cli" />
      </aside>
    </div>
  </main>
</template>
