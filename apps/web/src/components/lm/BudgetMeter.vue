<script setup lang="ts">
import { computed } from 'vue';
import { usd } from '@/lib/format';
import LmIcon from './LmIcon.vue';

/** Money is never a surprise: spent, estimate at finish and cap together. */
const props = defineProps<{ spent: number; cap: number | null; estimate?: number | null; paused?: boolean; caption?: string }>();
const level = computed(() => (props.cap === null ? 'ok' : props.spent >= props.cap ? 'over' : props.spent >= props.cap * 0.8 ? 'near' : 'ok'));
const label = computed(() => (level.value === 'over' ? (props.paused ? 'at cap · paused' : 'at cap') : level.value === 'near' ? 'near cap' : props.cap === null ? 'no cap' : 'within budget'));
const pct = (v: number) => `${Math.min(100, (v / (props.cap ?? 1)) * 100).toFixed(1)}%`;
</script>

<template>
  <div class="lm-budget">
    <div class="row-3">
      <span class="lm-status is-bare" :data-budget-label="level"><LmIcon name="coin" /><span>{{ label }}</span></span>
      <span class="grow" />
      <span class="numeric">{{ usd(spent) }}</span>
      <span v-if="cap !== null" class="caption muted">of {{ usd(cap) }}</span>
    </div>
    <div v-if="cap !== null" class="lm-meter" :data-budget="level" role="meter" aria-valuemin="0" :aria-valuemax="cap" :aria-valuenow="spent" :aria-label="`Budget: ${usd(spent)} of ${usd(cap)}`">
      <span :style="{ width: pct(spent) }" />
      <i v-if="estimate" :style="{ left: pct(estimate) }" :title="`estimate at finish ${usd(estimate)}`" />
    </div>
    <div v-if="caption" class="caption muted">{{ caption }}</div>
  </div>
</template>
