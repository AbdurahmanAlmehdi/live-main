<script setup lang="ts">
import { ref } from 'vue';
import LmIcon from './LmIcon.vue';

/** Every primary action shows its CLI equivalent, copyable. */
const props = defineProps<{ command: string; /** shorter text to show; the full command is still what gets copied */ short?: string }>();
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
  <code class="lm-cli-inline" :class="{ 'is-copied': copied }" :title="short ? command : undefined">
    $ {{ short ?? command }}
    <span v-if="copied" class="caption success"><LmIcon name="check" :size="14" />Copied</span>
    <button v-else type="button" class="lm-iconbtn" aria-label="Copy command" title="Copy command" @click="copy"><LmIcon name="copy" /></button>
  </code>
</template>
