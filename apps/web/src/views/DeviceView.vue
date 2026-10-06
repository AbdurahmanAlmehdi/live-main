<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import LmIcon from '@/components/lm/LmIcon.vue';
import { api } from '@/lib/api';
import { useSession } from '@/stores/session';

/** Approve `lm auth login` on a device: it receives a git token of its own. */
const route = useRoute();
const session = useSession();
const code = ref(typeof route.query.code === 'string' ? route.query.code : '');
const state = ref<'idle' | 'busy' | 'done'>('idle');
const error = ref('');

async function approve() {
  state.value = 'busy';
  error.value = '';
  try {
    await api.approveDevice(code.value.trim());
    state.value = 'done';
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
    state.value = 'idle';
  }
}
</script>

<template>
  <main class="lm-page is-narrow">
    <div class="stack-2">
      <h1 class="title-lg">Sign in the Live Main CLI</h1>
      <p class="body muted">
        Approve only if you just ran <span class="mono-sm">lm auth login</span> and this code matches the one in your terminal. The CLI gets its own token for {{ session.session?.user.login ?? 'you' }}; you can revoke it under <RouterLink to="/settings/tokens">Git tokens</RouterLink>.
      </p>
    </div>
    <section v-if="state === 'done'" class="lm-card">
      <span class="body-strong"><LmIcon name="check" /> Device approved</span>
      <span class="body muted">Go back to your terminal; <span class="mono-sm">lm</span> is signed in.</span>
    </section>
    <form v-else class="lm-key" @submit.prevent="approve">
      <span class="body-strong">Code from your terminal</span>
      <span class="row-2">
        <input v-model="code" class="lm-input mono-sm" placeholder="ABCD-EFGH" maxlength="9" autocomplete="off" spellcheck="false" aria-label="Device code" />
        <button type="submit" class="lm-btn is-primary" :disabled="state === 'busy' || code.trim().length < 9">{{ state === 'busy' ? 'Approving…' : 'Approve device' }}</button>
      </span>
      <p v-if="error" class="lm-error-text">{{ error }}</p>
    </form>
  </main>
</template>
