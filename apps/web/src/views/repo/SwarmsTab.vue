<script setup lang="ts">
import type { Swarm } from '@livemain/protocol';
import { ref } from 'vue';
import CliInline from '@/components/lm/CliInline.vue';
import LmIcon from '@/components/lm/LmIcon.vue';
import StateBox from '@/components/lm/StateBox.vue';
import SwarmSummary from '@/components/lm/SwarmSummary.vue';
import { api } from '@/lib/api';
import { useRepo } from '@/stores/repo';
import { useToasts } from '@/stores/toasts';

const repo = useRepo();
const toasts = useToasts();
const busy = ref<string | null>(null);
async function act(id: string, fn: (owner: string, name: string, id: string) => Promise<Swarm>) {
  busy.value = id;
  const s = await toasts.guard(() => fn(repo.owner, repo.name, id));
  if (s) repo.upsertSwarm(s);
  busy.value = null;
}
</script>

<template>
  <main class="lm-page">
    <div class="lm-page-head">
      <h2 class="title">Swarms</h2>
      <span class="grow" />
      <CliInline :command="`lm swarm list ${repo.owner}/${repo.name}`" />
      <RouterLink :to="`${repo.base}/dispatch`" class="lm-btn is-primary"><LmIcon name="play" />Dispatch swarm <kbd class="lm-kbd">D</kbd></RouterLink>
    </div>
    <StateBox v-if="repo.swarmList.length === 0" :title="`No swarms in ${repo.owner}/${repo.name} yet`" icon="swarms">
      Dispatch tasks to agents. They work in overlays on main and land when their tests pass.
      <template #actions>
        <RouterLink :to="`${repo.base}/dispatch`" class="lm-btn is-primary">Dispatch swarm <kbd class="lm-kbd">D</kbd></RouterLink>
        <CliInline :command="`lm swarm dispatch ${repo.owner}/${repo.name}`" />
      </template>
    </StateBox>
    <div v-else class="stack-3">
      <SwarmSummary
        v-for="s in repo.swarmList"
        :key="s.id"
        :swarm="s"
        :to="`${repo.base}/swarms/${s.id}`"
        :busy="busy === s.id"
        @pause="act(s.id, api.pause)"
        @resume="act(s.id, api.resume)"
        @stop="act(s.id, api.stop)"
      />
    </div>
  </main>
</template>
