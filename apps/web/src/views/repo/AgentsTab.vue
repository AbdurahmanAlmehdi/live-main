<script setup lang="ts">
import { FINAL_AGENT_STATES } from '@livemain/protocol';
import { computed, ref } from 'vue';
import AgentList from '@/components/lm/AgentList.vue';
import CliInline from '@/components/lm/CliInline.vue';
import SegControl from '@/components/lm/SegControl.vue';
import StateBox from '@/components/lm/StateBox.vue';
import { useRepo } from '@/stores/repo';

const repo = useRepo();
// Nobody working: show everyone who ran, not an empty list.
const show = ref<'active' | 'all'>(repo.activeAgents.length > 0 ? 'active' : 'all');
const agents = computed(() => (show.value === 'active' ? repo.agentList.filter((a) => !FINAL_AGENT_STATES.has(a.state)) : repo.agentList));
</script>

<template>
  <main class="lm-page">
    <div class="lm-page-head">
      <h2 class="title">Agents</h2>
      <SegControl v-model="show" label="Show agents" :options="[{ value: 'active', label: `Working ${repo.activeAgents.length}` }, { value: 'all', label: `All ${repo.agentList.length}` }]" />
      <span class="grow" />
      <CliInline :command="`lm agent list ${repo.owner}/${repo.name}`" />
    </div>
    <AgentList v-if="agents.length" :agents="agents" :link="(a) => `${repo.base}/agents/${encodeURIComponent(a.id)}`" />
    <StateBox v-else :title="show === 'active' ? 'No agent is working right now' : 'No agents have run here yet'" icon="agents">
      Agents appear here when a swarm starts them: each works in its own overlay on main.
      <template #actions><RouterLink :to="`${repo.base}/dispatch`" class="lm-btn is-primary">Dispatch a swarm</RouterLink></template>
    </StateBox>
  </main>
</template>
