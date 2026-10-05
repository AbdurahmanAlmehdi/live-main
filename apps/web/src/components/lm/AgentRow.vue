<script setup lang="ts">
import type { AgentSummary } from '@livemain/protocol';
import { agentName, ago, usd, workerText } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import StatusChip from './StatusChip.vue';

defineProps<{ agent: AgentSummary; to: string }>();
const now = useNow();
</script>

<template>
  <li class="lm-agent">
    <span class="mono-md">{{ agentName(agent.id) }}</span>
    <span class="ag-task"><RouterLink :to="to">{{ agent.taskTitle }}</RouterLink><span class="caption muted">{{ workerText(agent.worker) }}</span></span>
    <StatusChip :state="agent.state" />
    <span class="numeric ag-cost">{{ agent.worker.kind === 'model' ? usd(agent.cost.usd) : '—' }}</span>
    <span class="caption muted ag-last">{{ agent.detail }}<template v-if="agent.toolCalls"> · {{ agent.toolCalls }} tool calls</template></span>
    <span class="caption muted ag-time">{{ ago(agent.updatedAt, now) }}</span>
  </li>
</template>
