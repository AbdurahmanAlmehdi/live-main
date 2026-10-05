<script setup lang="ts">
import { computed } from 'vue';
import { ICONS, type IconName } from '@/lib/icons';

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 16 });
const inner = computed(() => ICONS[props.name]);
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- trusted, bundled icon markup -->
  <svg class="lm-icon" :width="size" :height="size" viewBox="0 0 16 16" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="inner" />
</template>
