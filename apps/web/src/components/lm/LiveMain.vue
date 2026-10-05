<script setup lang="ts">
import type { MainState } from '@livemain/protocol';
import { ago } from '@/lib/format';
import { useNow } from '@/lib/useNow';

/** Main is visibly live: version, a breathing dot, and what is approaching. */
defineProps<{ main: MainState | null; approaching?: number; lastLandingAt?: number | null; to?: string; compact?: boolean }>();
const now = useNow();
</script>

<template>
  <span v-if="compact" class="lm-livemini">
    <span class="lm-dot lm-live" aria-hidden="true" /><span class="mono-md">main <span :key="main?.version" class="lm-tick">v{{ main?.version ?? '–' }}</span></span>
  </span>
  <RouterLink v-else :to="to ?? ''" class="lm-livemain" title="Open Main (G M)">
    <span class="lm-dot lm-live" aria-hidden="true" />
    <span class="mono-md">main <span :key="main?.version" class="lm-tick">v{{ main?.version ?? '–' }}</span></span>
    <span class="vsep" />
    <span class="muted">{{ approaching ?? 0 }} approaching<template v-if="lastLandingAt"> · landed {{ ago(lastLandingAt, now) }} ago</template></span>
  </RouterLink>
</template>
