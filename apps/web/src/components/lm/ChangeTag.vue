<script setup lang="ts">
import type { ChangeClass } from '@livemain/protocol';
import LmIcon from './LmIcon.vue';

defineProps<{ change: ChangeClass }>();
</script>

<template>
  <span v-if="change !== 'none'" class="lm-tag" :data-change="change"><LmIcon :name="`change-${change}`" :size="14" />{{ change }}</span>
</template>
