<script setup lang="ts">
import { FINAL_AGENT_STATES, type AgentDetail } from '@livemain/protocol';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import ChangeTag from '@/components/lm/ChangeTag.vue';
import CliInline from '@/components/lm/CliInline.vue';
import DiffView from '@/components/lm/DiffView.vue';
import LmIcon from '@/components/lm/LmIcon.vue';
import NoticeCard from '@/components/lm/NoticeCard.vue';
import SegControl from '@/components/lm/SegControl.vue';
import StateBox from '@/components/lm/StateBox.vue';
import StatusChip from '@/components/lm/StatusChip.vue';
import VersionPill from '@/components/lm/VersionPill.vue';
import { api } from '@/lib/api';
import { agentName, ago, duration, plural, usd, workerText } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { useRepo } from '@/stores/repo';
import { useToasts } from '@/stores/toasts';

const repo = useRepo();
const toasts = useToasts();
const route = useRoute();
const now = useNow();
const id = computed(() => String(route.params.id));
const agent = ref<AgentDetail | null>(null);
const error = ref<string | null>(null);
const layout = ref<'unified' | 'split'>('unified');
const readFilter = ref<'changed' | 'all'>('changed');

async function load() {
  try {
    agent.value = await api.agent(repo.owner, repo.name, id.value);
    error.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  }
}
watch(id, () => {
  agent.value = null;
  void load();
}, { immediate: true });

// Live: reload (throttled) whenever the agent's summary changes in the event stream.
let pending: ReturnType<typeof setTimeout> | null = null;
watch(
  () => repo.agents.get(id.value)?.updatedAt,
  () => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      void load();
    }, 1200);
  },
);

const live = computed(() => repo.agents.get(id.value) ?? agent.value);
const active = computed(() => !!live.value && !FINAL_AGENT_STATES.has(live.value.state));
const head = computed(() => repo.repo?.main?.version ?? 0);
const behind = computed(() => (agent.value?.pin ? head.value - agent.value.pin : 0));
const reads = computed(() => (agent.value ? (readFilter.value === 'changed' ? agent.value.readSet.filter((r) => r.changedSincePin) : agent.value.readSet) : []));
const lastTest = computed(() => agent.value?.testRuns.at(-1) ?? null);
const totals = computed(() => (agent.value ? agent.value.patches.reduce((t, p) => ({ add: t.add + p.added, del: t.del + p.removed }), { add: 0, del: 0 }) : { add: 0, del: 0 }));

async function stop() {
  const a = await toasts.guard(() => api.stopAgent(repo.owner, repo.name, id.value), `${agentName(id.value)} will stop at its next tool call; its overlay is kept.`);
  if (a) void load();
}
</script>

<template>
  <main class="lm-page">
    <StateBox v-if="error" kind="error" title="Couldn’t load this agent">{{ error }}</StateBox>
    <StateBox v-else-if="!agent || !live" kind="loading" title="Loading agent…" />
    <template v-else>
      <div class="stack-3">
        <div class="row-3">
          <span class="mono-title">{{ agentName(agent.id) }}</span>
          <h2 class="title-lg">{{ agent.taskTitle }}</h2>
          <span class="grow" />
          <CliInline :command="`lm agent view ${agent.id} ${repo.owner}/${repo.name}`" />
          <button v-if="active" type="button" class="lm-btn is-danger" @click="stop"><LmIcon name="stop" />Stop agent</button>
        </div>
        <div class="row-3">
          <StatusChip :state="live.state" />
          <span class="body muted">{{ live.detail }}</span>
        </div>
        <div class="lm-facts">
          <div><span class="caption-strong muted">WORKER</span><span class="body">{{ workerText(agent.worker) }}</span></div>
          <div>
            <span class="caption-strong muted">VIEW OF MAIN</span>
            <span v-if="agent.landedVersion" class="body">landed as <RouterLink :to="`${repo.base}/main/${agent.landedVersion}`"><VersionPill :version="agent.landedVersion" kind="main" /></RouterLink></span>
            <span v-else-if="agent.pin" class="lm-behind">
              <VersionPill :version="agent.pin" kind="pinned" /><span class="muted">→</span><VersionPill :version="head" kind="main" />
              <span class="caption muted">{{ behind > 0 ? `${behind} behind · advances at next checkpoint` : 'up to date' }}</span>
            </span>
            <span v-else class="body muted">not started</span>
          </div>
          <div><span class="caption-strong muted">TESTS</span><span class="body">{{ lastTest ? (lastTest.ok ? `${lastTest.passed} passing` : `${lastTest.failed} failing`) : 'not run yet' }}</span></div>
          <div><span class="caption-strong muted">COST</span><span class="numeric">{{ agent.worker.kind === 'model' ? usd(agent.cost.usd) : '—' }}</span></div>
          <div><span class="caption-strong muted">ACTIVITY</span><span class="body">{{ plural(agent.toolCalls, 'tool call') }} · {{ duration((agent.finishedAt ?? now) - agent.startedAt) }}</span></div>
          <div><span class="caption-strong muted">NOTICES</span><span class="body">{{ agent.notices.interrupt }} interrupt · {{ agent.notices.review }} review · {{ plural(agent.guards, 'guard') }}</span></div>
        </div>
      </div>

      <section class="lm-section" aria-labelledby="overlay">
        <div class="row-3">
          <h3 id="overlay" class="title-sm">{{ agent.landedVersion ? 'What landed' : 'Overlay' }}</h3>
          <span class="body-strong">{{ plural(agent.patches.length, 'file') }} written</span>
          <span class="mono-sm"><span class="add-fg">+{{ totals.add }}</span> <span class="del-fg">−{{ totals.del }}</span></span>
          <span class="caption muted">{{ agent.landedVersion ? `as landed in v${agent.landedVersion}` : active ? `against main v${head}` : 'its last published overlay, against its pin' }}</span>
          <span class="grow" />
          <SegControl v-model="layout" label="Diff layout" :options="[{ value: 'unified', label: 'Unified' }, { value: 'split', label: 'Split' }]" />
        </div>
        <div v-if="agent.patches.length" class="stack-3"><DiffView v-for="p in agent.patches" :key="p.path" :patch="p" :layout="layout" /></div>
        <p v-else class="caption muted">No files written yet.</p>
      </section>

      <div class="lm-split">
        <section class="lm-section" aria-labelledby="notices">
          <h3 id="notices" class="title-sm">Notices and guards</h3>
          <div v-for="g in agent.guardList" :key="g.at" class="lm-notice" data-notice="interrupt">
            <header><StatusChip bare state="guarded" /><span class="body-strong">Landing stopped before it reached main</span><span class="grow" /><span class="caption muted">{{ ago(g.at, now) }} ago</span></header>
            <p class="body">It would have broken {{ plural(g.tests.length, 'test file') }} already on main: <span class="mono-sm">{{ g.tests.map((t) => t.split('/').pop()).join(', ') }}</span>. Nothing landed; the agent kept working.</p>
          </div>
          <NoticeCard v-for="n in agent.noticeList.slice().reverse()" :key="n.id" :notice="n" />
          <p v-if="!agent.guardList.length && !agent.noticeList.some((n) => n.severity !== 'ignore')" class="caption muted">Nothing it read or wrote changed on main while it worked.</p>
        </section>
        <aside class="stack-4">
          <section class="lm-section" aria-labelledby="readset">
            <div class="row-3">
              <h3 id="readset" class="title-sm">Read set</h3>
              <span class="caption muted">{{ agent.readSet.length }} files</span>
              <span class="grow" />
              <SegControl v-model="readFilter" label="Read set filter" :options="[{ value: 'changed', label: 'Changed' }, { value: 'all', label: 'All' }]" />
            </div>
            <ul v-if="reads.length" class="lm-list">
              <li v-for="r in reads" :key="r.path" style="min-height: 36px"><code class="mono-sm" style="overflow: hidden; text-overflow: ellipsis">{{ r.path }}</code><span class="grow" /><ChangeTag v-if="r.changedSincePin" :change="r.changedSincePin" /></li>
            </ul>
            <p v-else class="caption muted">{{ readFilter === 'changed' ? 'None of the files it read changed on main since its pin.' : 'No reads recorded.' }}</p>
          </section>
          <section class="lm-section">
            <h3 class="title-sm">Checkpoints</h3>
            <p v-if="!agent.checkpoints.length" class="caption muted">No checkpoints yet.</p>
            <ul v-else class="lm-list">
              <li v-for="c in agent.checkpoints.slice().reverse().slice(0, 8)" :key="c.at" style="min-height: 36px"><VersionPill :version="c.from" kind="pinned" /><span class="muted">→</span><VersionPill :version="c.to" /><span class="caption muted">{{ plural(c.notices, 'notice') }}</span><span class="grow" /><span class="caption muted">{{ ago(c.at, now) }}</span></li>
            </ul>
          </section>
        </aside>
      </div>

      <details class="lm-card">
        <summary>Activity · {{ plural(agent.steps.length, 'step') }}</summary>
        <ol class="lm-log">
          <li v-for="s in agent.steps.slice().reverse()" :key="s.seq" :class="{ 'is-error': !s.ok }"><span class="muted">{{ s.seq }}</span><span>{{ s.tool }}</span><span :title="s.summary">{{ s.summary }}</span><span class="muted">{{ ago(s.at, now) }}</span></li>
        </ol>
      </details>
      <details class="lm-card">
        <summary>Task prompt</summary>
        <pre class="mono-sm" style="white-space: pre-wrap; margin: 0">{{ agent.prompt }}</pre>
      </details>
    </template>
  </main>
</template>
