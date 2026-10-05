<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import CliInline from '@/components/lm/CliInline.vue';
import StateBox from '@/components/lm/StateBox.vue';
import TimelineRow from '@/components/lm/TimelineRow.vue';
import { useRepo } from '@/stores/repo';

const repo = useRepo();
const loadingMore = ref(false);
async function more() {
  loadingMore.value = true;
  await repo.moreLandings().catch(() => undefined);
  loadingMore.value = false;
}
// New rows are highlighted while this view is open, then settle.
onBeforeUnmount(() => (repo.newLandings = new Set()));
</script>

<template>
  <main class="lm-page">
    <div class="lm-page-head">
      <h2 class="title">Landed on main</h2>
      <span class="caption muted">Every landing is a git commit. Agents’ changes reach main only when the tests of code already on main still pass.</span>
      <span class="grow" />
      <CliInline :command="`lm main log ${repo.owner}/${repo.name}`" />
    </div>
    <StateBox v-if="repo.landings.length === 0" kind="loading" title="Loading landings…" />
    <ol v-else class="lm-timeline" aria-label="Landed on main">
      <TimelineRow v-for="l in repo.landings" :key="l.version" :landing="l" :to="`${repo.base}/main/${l.version}`" :is-new="repo.newLandings.has(l.version)" />
    </ol>
    <div v-if="(repo.landings.at(-1)?.version ?? 1) > 1" class="row-3">
      <button type="button" class="lm-btn is-secondary" :disabled="loadingMore" @click="more">{{ loadingMore ? 'Loading…' : 'Older landings' }}</button>
    </div>
  </main>
</template>
