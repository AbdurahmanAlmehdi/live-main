<script setup lang="ts">
import type { AgentState } from '@livemain/protocol';
import { computed } from 'vue';
import type { IconName } from '@/lib/icons';
import { STATE_LABEL } from '@/lib/format';
import LmIcon from './LmIcon.vue';

type ChipState = AgentState | 'live-main' | 'notice-interrupt' | 'notice-review';

/** Status is the hero: label plus icon, never colour alone. */
const props = defineProps<{ state: ChipState; label?: string; bare?: boolean }>();
const icon = computed<IconName>(() => props.state);
const text = computed(() => props.label ?? (props.state in STATE_LABEL ? STATE_LABEL[props.state as AgentState] : props.state.replace('notice-', '')));
</script>

<template>
  <span class="lm-status" :class="{ 'is-bare': bare }" :data-state="state"><LmIcon :name="icon" /><span>{{ text }}</span></span>
</template>
