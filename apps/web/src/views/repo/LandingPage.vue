<script setup lang="ts">
import type { LandingDetail } from '@livemain/protocol';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import CliInline from '@/components/lm/CliInline.vue';
import DiffView from '@/components/lm/DiffView.vue';
import LmIcon from '@/components/lm/LmIcon.vue';
import SegControl from '@/components/lm/SegControl.vue';
import StateBox from '@/components/lm/StateBox.vue';
import StatusChip from '@/components/lm/StatusChip.vue';
import VersionPill from '@/components/lm/VersionPill.vue';
import { api } from '@/lib/api';
import { agentName, ago, plural, workerText } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { useRepo } from '@/stores/repo';

const repo = useRepo();
const route = useRoute();
const now = useNow();
const landing = ref<LandingDetail | null>(null);
const error = ref<string | null>(null);
const layout = ref<'unified' | 'split'>('unified');
const version = computed(() => Number(route.params.version));

watch(
  version,
  async (v) => {
    landing.value = null;
    try {
      landing.value = await api.landing(repo.owner, repo.name, v);
      error.value = null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  },
  { immediate: true },
);
// CI results arrive after the landing: keep them current.
watch(
  () => repo.landings.find((l) => l.version === version.value)?.ci,
  (ci) => {
    if (landing.value && ci) landing.value = { ...landing.value, ci };
  },
);

const totals = computed(() => (landing.value ? landing.value.patches.reduce((t, p) => ({ add: t.add + p.added, del: t.del + p.removed }), { add: 0, del: 0 }) : { add: 0, del: 0 }));
const by = computed(() => {
  const b = landing.value?.by;
  if (!b) return '';
  if (b.kind === 'agent') return `${landing.value?.changeOrder ? 'change order' : 'agent landing'} · ${agentName(b.agentId)} · ${workerText(b.worker)}`;
  if (b.kind === 'human') return `push from ${b.via === 'github' ? 'GitHub' : 'git'} · ${b.name}`;
  return 'repository created';
});
/** On whose authority, and under which policy, this change reached main. */
const provenance = computed(() => {
  const l = landing.value;
  if (!l) return [];
  const out: string[] = [];
  if (l.by.kind === 'agent' && l.by.delegatedBy) out.push(`dispatched by ${l.by.delegatedBy}`);
  if (l.approval) out.push(`protected ${l.approval.paths.join(', ')}: approved by ${l.approval.by}`);
  return out;
});
const interrupts = computed(() => landing.value?.noticed.filter((n) => n.severity === 'interrupt') ?? []);
const reviews = computed(() => landing.value?.noticed.filter((n) => n.severity === 'review') ?? []);
</script>

<template>
  <main class="lm-page">
    <StateBox v-if="error" kind="error" :title="`Couldn’t load v${version}`">{{ error }}</StateBox>
    <StateBox v-else-if="!landing" kind="loading" :title="`Loading v${version}…`" />
    <template v-else>
      <div class="stack-2">
        <div class="row-3">
          <VersionPill :version="landing.version" :kind="landing.version === repo.repo?.main?.version ? 'main' : 'plain'" />
          <h2 class="title-lg">{{ landing.title }}</h2>
        </div>
        <div class="row-3 caption muted">
          <span>{{ by }}</span><span>{{ ago(landing.at, now) }} ago</span><code class="mono-sm">{{ landing.sha.slice(0, 10) }}</code>
          <RouterLink v-if="landing.by.kind === 'agent'" :to="`${repo.base}/agents/${encodeURIComponent(landing.by.agentId)}`">open agent</RouterLink>
          <span class="grow" />
          <CliInline :command="`lm main show ${landing.version} ${repo.owner}/${repo.name}`" />
        </div>
        <div v-if="provenance.length" class="row-3 caption"><LmIcon name="check" :size="14" /><span v-for="p in provenance" :key="p">{{ p }}</span></div>
      </div>

      <div class="lm-grid-3">
        <div class="lm-card">
          <span class="caption-strong muted">CHANGE</span>
          <span class="body">{{ plural(landing.patches.length, 'file') }} · <span class="add-fg">+{{ totals.add }}</span> <span class="del-fg">−{{ totals.del }}</span></span>
          <span class="caption muted">{{ landing.merged > 0 ? `${plural(landing.merged, 'file')} merged automatically with concurrent landings` : 'No automatic merges needed' }}</span>
        </div>
        <div class="lm-card">
          <span class="caption-strong muted">GUARD</span>
          <span v-if="landing.by.kind !== 'agent'" class="body">Not an agent landing</span>
          <span v-else-if="landing.impactTests.length === 0" class="body">No impact tests needed: nothing on main read a changed contract or body</span>
          <span v-else class="body">{{ plural(landing.impactTests.length, 'test file') }} already on main ran and passed before landing</span>
          <span v-if="landing.impactTests.length" class="caption muted mono-sm">{{ landing.impactTests.slice(0, 4).join(', ') }}{{ landing.impactTests.length > 4 ? ', …' : '' }}</span>
        </div>
        <div class="lm-card">
          <span class="caption-strong muted">AFTER LANDING</span>
          <span class="row-2">
            <StatusChip v-if="landing.ci" bare :state="landing.ci.failed === 0 ? 'landed' : 'error'" :label="landing.ci.failed === 0 ? `CI ${landing.ci.passed} passing` : `CI ${landing.ci.failed} failing`" />
            <StatusChip v-else bare state="testing" label="CI pending" />
          </span>
          <span class="caption muted">{{ interrupts.length ? `interrupted ${plural(interrupts.length, 'agent')}` : 'interrupted no one' }}{{ reviews.length ? ` · review notices to ${reviews.length}` : '' }}</span>
        </div>
      </div>

      <div class="row-3">
        <span class="body-strong">{{ plural(landing.patches.length, 'file') }} changed</span>
        <span class="grow" />
        <SegControl v-model="layout" label="Diff layout" :options="[{ value: 'unified', label: 'Unified' }, { value: 'split', label: 'Split' }]" />
      </div>
      <div class="stack-3">
        <DiffView v-for="p in landing.patches" :key="p.path" :patch="p" :layout="layout" :collapsed="landing.patches.length > 8" />
      </div>
    </template>
  </main>
</template>
