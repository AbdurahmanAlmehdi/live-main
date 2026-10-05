<script setup lang="ts" generic="T extends string">
defineProps<{ options: { value: T; label: string }[]; label: string }>();
const model = defineModel<T>({ required: true });
</script>

<template>
  <div class="lm-seg" role="group" :aria-label="label">
    <button v-for="o in options" :key="o.value" type="button" :aria-pressed="model === o.value" @click="model = o.value">{{ o.label }}</button>
  </div>
</template>
