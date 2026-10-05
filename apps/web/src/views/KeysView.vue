<script setup lang="ts">
import { PROVIDERS, type ProviderId } from '@livemain/protocol';
import { onMounted } from 'vue';
import KeyField from '@/components/lm/KeyField.vue';
import StateBox from '@/components/lm/StateBox.vue';
import { useSession } from '@/stores/session';

const session = useSession();
onMounted(() => session.loadKeys());
const providers = Object.keys(PROVIDERS) as ProviderId[];
</script>

<template>
  <main class="lm-page is-narrow">
    <div class="stack-2">
      <h1 class="title-lg">Model keys</h1>
      <p class="body muted">Agents run on your own keys. Each key is encrypted at rest, only decrypted inside the agent runner while it calls the model, and never shown again, sent to a container, or written to a log.</p>
    </div>
    <StateBox v-if="session.keys === null" kind="loading" title="Loading keys…" :rows="3" />
    <div v-else class="stack-3">
      <KeyField v-for="p in providers" :key="p" :provider="p" :info="session.keys.find((k) => k.provider === p)" />
    </div>
  </main>
</template>
