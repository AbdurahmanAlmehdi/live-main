<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import CliInline from '@/components/lm/CliInline.vue';
import LiveMain from '@/components/lm/LiveMain.vue';
import LmIcon from '@/components/lm/LmIcon.vue';
import RepoTabs, { type TabDef } from '@/components/lm/RepoTabs.vue';
import StateBox from '@/components/lm/StateBox.vue';
import { usd } from '@/lib/format';
import { useRepo } from '@/stores/repo';

const props = defineProps<{ owner: string; name: string }>();
const repo = useRepo();
const route = useRoute();
watch(() => [props.owner, props.name] as const, ([o, n]) => void repo.open(o, n), { immediate: true });

const section = computed(() => String(route.name ?? ''));
const tabs = computed<TabDef[]>(() => {
  const b = repo.base;
  const r = repo.repo;
  const running = repo.swarmList.filter((s) => s.status === 'running' || s.status === 'paused').length;
  const active = repo.activeAgents.length;
  return [
    { to: b, label: 'Code', icon: 'code', shortcut: 'G C', active: section.value === 'code' || section.value === 'file' },
    { to: `${b}/main`, label: 'Main', icon: 'main', shortcut: 'G M', count: r?.main?.version ?? null, active: section.value === 'main' || section.value === 'landing' },
    { to: `${b}/swarms`, label: 'Swarms', icon: 'swarms', shortcut: 'G S', count: running ? `${running} running` : repo.swarmList.length || null, live: running > 0, active: section.value.startsWith('swarm') || section.value === 'dispatch' },
    { to: `${b}/agents`, label: 'Agents', icon: 'agents', shortcut: 'G A', count: active || null, live: active > 0, active: section.value.startsWith('agent') },
    { to: `${b}/tasks`, label: 'Tasks', icon: 'tasks', shortcut: 'G T', active: section.value === 'tasks' },
    { to: `${b}/approvals`, label: 'Approvals', icon: 'notice-review', shortcut: 'G R', count: repo.pendingApprovals.length || null, live: repo.pendingApprovals.length > 0, active: section.value === 'approvals' },
    { to: `${b}/settings`, label: 'Settings', icon: 'settings', shortcut: '', active: section.value === 'repo-settings' },
  ];
});
const sourceLabel = computed(() => {
  const s = repo.repo?.source;
  return !s ? '' : s.kind === 'imported' ? 'imported' : s.kind === 'github' ? `GitHub · ${s.repo}` : 'hosted';
});
const swarm = computed(() => repo.runningSwarm);
const pct = (n: number) => `${((n / Math.max(1, swarm.value?.counts.total ?? 1)) * 100).toFixed(2)}%`;
</script>

<template>
  <div>
    <StateBox v-if="repo.error" kind="error" title="Couldn’t open this repository" style="margin: 24px">
      {{ repo.error }}
      <template #actions><RouterLink to="/" class="lm-btn is-secondary">Your repositories</RouterLink></template>
    </StateBox>
    <template v-else>
      <header class="lm-repohead">
        <div class="lm-repohead-top">
          <h1 class="lm-repohead-name"><LmIcon name="repo" :size="20" /><RouterLink :to="repo.base">{{ owner }}/<strong>{{ name }}</strong></RouterLink></h1>
          <span v-if="repo.repo" class="lm-source">{{ sourceLabel }}</span>
          <LiveMain v-if="repo.repo" :main="repo.repo.main" :approaching="repo.repo.activity.approaching" :last-landing-at="repo.repo.activity.lastLandingAt" :to="`${repo.base}/main`" />
          <span class="grow" />
          <CliInline v-if="repo.repo" :command="`git clone ${repo.repo.cloneUrl}`" :short="`git clone …/${name}.git`" />
          <RouterLink :to="`${repo.base}/dispatch`" class="lm-btn is-primary" title="Dispatch a swarm (D)"><LmIcon name="play" />Dispatch <kbd class="lm-kbd">D</kbd></RouterLink>
        </div>
        <RepoTabs :tabs="tabs">
          <span v-if="repo.repo" class="caption muted tabs-sum">Today <strong class="numeric">{{ repo.repo.activity.landingsToday }}</strong> landings · <strong class="numeric">{{ repo.repo.activity.guardsToday }}</strong> guards · <strong class="numeric">0</strong> rebases</span>
        </RepoTabs>
      </header>
      <RouterView v-if="repo.repo" />
      <main v-else class="lm-page"><StateBox kind="loading" title="Opening repository…" /></main>
      <footer class="lm-statusline" aria-label="Status">
        <LiveMain compact :main="repo.repo?.main ?? null" />
        <span class="lm-livemini" :title="repo.live ? 'Live updates connected' : 'Reconnecting to live updates'"><span class="lm-dot" :style="{ background: repo.live ? undefined : 'var(--lm-color-status-attention-fg)' }" aria-hidden="true" /><span>{{ repo.live ? 'live' : 'reconnecting' }}</span></span>
        <template v-if="swarm">
          <span class="vsep" />
          <RouterLink :to="`${repo.base}/swarms/${swarm.id}`" class="caption-strong">{{ swarm.name }}</RouterLink>
          <span class="lm-stack" role="img" :aria-label="`${swarm.counts.landed} of ${swarm.counts.total} landed`"><span :style="{ width: pct(swarm.counts.landed) }" data-seg="landed" /><span :style="{ width: pct(swarm.counts.running) }" data-seg="running" /><span :style="{ width: pct(swarm.counts.queued) }" data-seg="queued" /></span>
          <span class="numeric">{{ swarm.counts.landed }}/{{ swarm.counts.total }}</span>
          <span class="hide-phone">{{ swarm.counts.running }} running · {{ swarm.counts.queued }} queued<template v-if="swarm.status !== 'running'"> · {{ swarm.status }}</template></span>
          <span v-if="swarm.rules.some((r) => r.worker.kind === 'model')" class="numeric hide-phone">{{ usd(swarm.cost.usd) }}</span>
        </template>
        <span v-else class="hide-phone">No swarm running</span>
        <span class="grow" />
        <span class="hide-phone"><kbd class="lm-kbd">⌘K</kbd> jump · <kbd class="lm-kbd">G</kbd> then a letter for tabs</span>
      </footer>
    </template>
  </div>
</template>
