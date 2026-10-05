<script setup lang="ts">
import { ref } from 'vue';
import LmIcon from './LmIcon.vue';

const props = defineProps<{ command: string; label?: string }>();
const copied = ref(false);
async function copy() {
  try {
    await navigator.clipboard.writeText(props.command);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {
    // clipboard blocked: the command stays selectable
  }
}
</script>

<template>
  <div class="lm-cli">
    <span class="lm-cli-label caption muted"><LmIcon name="terminal" :size="14" />{{ label ?? 'Same from the CLI' }}</span>
    <pre class="mono-sm"><span class="muted">$</span> {{ command }}</pre>
    <button type="button" class="lm-btn is-ghost is-sm" @click="copy"><LmIcon :name="copied ? 'check' : 'copy'" :size="14" />{{ copied ? 'Copied' : 'Copy' }}</button>
  </div>
</template>
