<script setup lang="ts">
import type { IconName } from '@/lib/icons';
import LmIcon from './LmIcon.vue';

export interface TabDef {
  to: string;
  label: string;
  icon: IconName;
  count?: string | number | null;
  live?: boolean;
  shortcut: string;
  active: boolean;
}
defineProps<{ tabs: TabDef[] }>();
</script>

<template>
  <nav class="lm-tabs" aria-label="Repository">
    <RouterLink v-for="t in tabs" :key="t.to" :to="t.to" class="lm-tab" :aria-current="t.active ? 'page' : undefined" :title="`${t.label} (${t.shortcut})`">
      <LmIcon :name="t.icon" />{{ t.label }}<span v-if="t.count !== null && t.count !== undefined && t.count !== ''" class="lm-count" :class="{ 'is-live': t.live }">{{ t.count }}</span>
    </RouterLink>
    <span class="grow" />
    <slot />
  </nav>
</template>
