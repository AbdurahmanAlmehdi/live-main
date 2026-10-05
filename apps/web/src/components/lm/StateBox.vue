<script setup lang="ts">
import type { IconName } from '@/lib/icons';
import LmIcon from './LmIcon.vue';

/** Empty, loading and error states: say what happened and the one next step. */
withDefaults(defineProps<{ kind?: 'empty' | 'loading' | 'error'; title?: string; icon?: IconName; rows?: number }>(), { kind: 'empty', rows: 4 });
</script>

<template>
  <div v-if="kind === 'loading'" class="lm-state is-loading" aria-busy="true" :aria-label="title ?? 'Loading'">
    <div class="caption muted">{{ title ?? 'Loading…' }}</div>
    <div v-for="i in rows" :key="i" class="sk-row"><span class="sk" style="width: 28px" /><span class="sk" :style="{ width: `${48 + ((i * 13) % 28)}%` }" /><span class="sk" style="width: 64px" /></div>
  </div>
  <div v-else class="lm-state" :class="{ 'is-error': kind === 'error' }" :role="kind === 'error' ? 'alert' : undefined">
    <LmIcon :name="icon ?? (kind === 'error' ? 'error' : 'repo')" :size="20" />
    <div class="title-sm">{{ title }}</div>
    <div class="body muted"><slot /></div>
    <div v-if="$slots.actions" class="row-2 wrap"><slot name="actions" /></div>
  </div>
</template>
