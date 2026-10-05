<script setup lang="ts">
import { useToasts } from '@/stores/toasts';
import LmIcon from './LmIcon.vue';

const toasts = useToasts();
</script>

<template>
  <div class="lm-toasts" aria-live="polite">
    <div v-for="t in toasts.items" :key="t.id" class="lm-toast" :class="{ 'is-error': t.kind === 'error' }" :role="t.kind === 'error' ? 'alert' : 'status'">
      <LmIcon :name="t.kind === 'error' ? 'error' : 'check'" />
      <span class="body">{{ t.text }}</span>
      <button type="button" class="lm-iconbtn" aria-label="Dismiss" @click="toasts.dismiss(t.id)"><LmIcon name="close" /></button>
    </div>
  </div>
</template>
