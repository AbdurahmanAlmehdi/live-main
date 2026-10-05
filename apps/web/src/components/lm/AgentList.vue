<script setup lang="ts">
import type { AgentSummary } from '@livemain/protocol';
import AgentRow from './AgentRow.vue';

defineProps<{ agents: AgentSummary[]; link: (a: AgentSummary) => string }>();
</script>

<template>
  <ul class="lm-agents" aria-label="Agents">
    <li class="lm-agents-head caption-strong muted"><span>AGENT</span><span>TASK · MODEL</span><span>STATUS</span><span class="ag-cost">COST</span><span>LAST ACTION</span><span /></li>
    <AgentRow v-for="a in agents" :key="a.id" :agent="a" :to="link(a)" />
  </ul>
</template>
