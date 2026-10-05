<script setup lang="ts">
import type { Swarm } from '@livemain/protocol';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AgentList from '@/components/lm/AgentList.vue';
import NoticeCard from '@/components/lm/NoticeCard.vue';
import SegControl from '@/components/lm/SegControl.vue';
import StateBox from '@/components/lm/StateBox.vue';
import SwarmSummary from '@/components/lm/SwarmSummary.vue';
import TimelineRow from '@/components/lm/TimelineRow.vue';
import { api } from '@/lib/api';
import { useRepo } from '@/stores/repo';
import { useToasts } from '@/stores/toasts';

const repo = useRepo();
const toasts = useToasts();
const route = useRoute();
const id = computed(() => String(route.params.id));
const swarm = computed(() => repo.swarms.get(id.value) ?? null);
const busy = ref(false);
const show = ref<'active' | 'all'>('active');
// A finished swarm has nobody working: show everyone it ran.
watch(
  () => swarm.value?.status,
  (s) => {
    if (s === 'finished' || s === 'stopped') show.value = 'all';
  },
  { immediate: true },
);

const agents = computed(() => repo.agentList.filter((a) => a.swarmId === id.value));
const shownAgents = computed(() => (show.value === 'active' ? agents.value.filter((a) => !['landed', 'gave-up', 'stopped', 'error'].includes(a.state)) : agents.value));
const ids = computed(() => new Set(agents.value.map((a) => a.id)));
const notices = computed(() => repo.notices.filter((n) => ids.value.has(n.agentId) && n.severity !== 'ignore').slice(0, 12));
const landings = computed(() => repo.landings.filter((l) => l.by.kind === 'agent' && l.by.swarmId === id.value).slice(0, 12));
const atCap = computed(() => swarm.value?.status === 'paused' && (swarm.value.reason ?? '').includes('cap'));
const newCap = ref<number | null>(null);

async function act(fn: (owner: string, name: string, id: string) => Promise<Swarm>) {
  busy.value = true;
  const s = await toasts.guard(() => fn(repo.owner, repo.name, id.value));
  if (s) repo.upsertSwarm(s);
  busy.value = false;
}
async function raiseCap() {
  if (newCap.value === null) return;
  const s = await toasts.guard(() => api.setBudget(repo.owner, repo.name, id.value, { maxUsd: newCap.value }), 'Budget raised.');
  if (s) repo.upsertSwarm(s);
}
</script>

<template>
  <main class="lm-page">
    <StateBox v-if="!swarm" kind="error" title="No such swarm">It may belong to another repository.</StateBox>
    <template v-else>
      <SwarmSummary :swarm="swarm" :busy="busy" @pause="act(api.pause)" @resume="act(api.resume)" @stop="act(api.stop)" />
      <form v-if="atCap" class="lm-card" @submit.prevent="raiseCap">
        <span class="body-strong">The swarm paused at its budget cap.</span>
        <span class="body muted">Agents already running finished their tasks. Raise the cap to continue, or stop the swarm.</span>
        <span class="row-2"><span class="lm-affix"><span class="muted">$</span><input v-model.number="newCap" class="lm-input" type="number" min="0" step="1" aria-label="New budget cap in dollars" /></span><button type="submit" class="lm-btn is-primary">Raise cap</button><button type="button" class="lm-btn is-secondary" @click="act(api.resume)">Resume</button></span>
      </form>
      <div class="lm-split">
        <section class="lm-section" aria-label="Agents">
          <div class="row-3">
            <h3 class="title-sm">Agents</h3>
            <span class="grow" />
            <SegControl v-model="show" label="Show agents" :options="[{ value: 'active', label: 'Working' }, { value: 'all', label: `All ${agents.length}` }]" />
          </div>
          <AgentList v-if="shownAgents.length" :agents="shownAgents" :link="(a) => `${repo.base}/agents/${encodeURIComponent(a.id)}`" />
          <StateBox v-else :title="show === 'active' ? 'No agent is working right now' : 'No agents yet'" icon="agents">
            {{ swarm.status === 'running' ? 'Agents start as slots free up.' : 'This swarm is not running.' }}
          </StateBox>
        </section>
        <aside class="stack-4" aria-label="What is happening">
          <section class="lm-section">
            <h3 class="title-sm">Notices</h3>
            <p v-if="notices.length === 0" class="caption muted">When main changes something an agent read or wrote, it shows up here, with what the agent did about it.</p>
            <NoticeCard v-for="n in notices" :key="n.id" :notice="{ ...n, outcome: null }" />
          </section>
          <section class="lm-section">
            <h3 class="title-sm">Landed from this swarm</h3>
            <ol v-if="landings.length" class="lm-timeline is-compact">
              <TimelineRow v-for="l in landings" :key="l.version" :landing="l" :to="`${repo.base}/main/${l.version}`" :is-new="repo.newLandings.has(l.version)" />
            </ol>
            <p v-else class="caption muted">Nothing yet.</p>
          </section>
        </aside>
      </div>
    </template>
  </main>
</template>
