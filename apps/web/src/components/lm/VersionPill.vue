<script setup lang="ts">
defineProps<{ version: number; kind?: 'main' | 'pinned' | 'plain'; label?: string }>();
</script>

<template>
  <span class="lm-ver" :class="{ 'is-main': kind === 'main', 'is-pinned': kind === 'pinned' }">{{ label ? `${label} ` : '' }}v{{ version }}</span>
</template>
