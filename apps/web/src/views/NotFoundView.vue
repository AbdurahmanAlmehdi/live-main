<script setup lang="ts">
import StateBox from '@/components/lm/StateBox.vue';
</script>

<template>
  <main class="lm-page is-narrow">
    <StateBox kind="error" title="Nothing here">
      This page does not exist.
      <template #actions><RouterLink to="/" class="lm-btn is-secondary">Go to your repositories</RouterLink></template>
    </StateBox>
  </main>
</template>
