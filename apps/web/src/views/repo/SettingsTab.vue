<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import CliInline from '@/components/lm/CliInline.vue';
import { api } from '@/lib/api';
import { useRepo } from '@/stores/repo';
import { useToasts } from '@/stores/toasts';

const repo = useRepo();
const r = computed(() => repo.repo!);
const source = computed(() => {
  const s = r.value.source;
  return s.kind === 'imported' ? `Imported from ${s.url}` : s.kind === 'github' ? `Connected to GitHub ${s.repo} (lands as ${s.landing === 'pull-request' ? 'one updating pull request' : 'direct pushes'} to ${s.branch})` : 'Hosted on Live Main';
});

// Policy: protected paths, one glob per line.
const toasts = useToasts();
const globs = ref('');
const saved = ref('');
const saving = ref(false);
onMounted(async () => {
  const p = await toasts.guard(() => api.policy(repo.owner, repo.name));
  if (p) globs.value = saved.value = p.protectedPaths.join('\n');
});
async function savePolicy() {
  saving.value = true;
  const p = await toasts.guard(() => api.setPolicy(repo.owner, repo.name, { protectedPaths: globs.value.split('\n') }), 'Policy saved.');
  saving.value = false;
  if (p) globs.value = saved.value = p.protectedPaths.join('\n');
}
</script>

<template>
  <main class="lm-page is-narrow">
    <h2 class="title">Settings</h2>
    <section class="lm-card">
      <span class="caption-strong muted">SOURCE</span>
      <span class="body">{{ source }}</span>
      <span class="caption-strong muted">CLONE</span>
      <CliInline :command="`git clone ${r.cloneUrl}`" />
      <span class="caption muted">Use a <RouterLink to="/settings/tokens">git token</RouterLink> as the password. Pushes to main land through Live Main: newer main is merged in, tests already on main run first, and agents reading the changed files are told. <span class="mono-sm">git push -o change-order</span> lands as a change order.</span>
    </section>
    <form class="lm-card" @submit.prevent="savePolicy">
      <span class="caption-strong muted">PROTECTED PATHS</span>
      <span class="caption muted">An agent’s landing that changes one of these waits for a person’s approval (Approvals tab). One glob per line: <span class="mono-sm">src/core/**</span>, <span class="mono-sm">package.json</span>, <span class="mono-sm">**/*.sql</span>.</span>
      <textarea v-model="globs" class="lm-input mono-sm policy" rows="4" spellcheck="false" aria-label="Protected path globs" placeholder="src/core/**"></textarea>
      <span><button type="submit" class="lm-btn is-secondary" :disabled="saving || globs === saved">{{ saving ? 'Saving…' : 'Save policy' }}</button></span>
    </form>
    <section class="lm-card">
      <span class="caption-strong muted">TEMPLATE</span>
      <span class="body">{{ r.template ?? 'None' }}</span>
      <span v-if="r.template" class="caption muted">CI covers the core tests plus the tests of every task that has landed; the template ships acceptance tests for work not done yet.</span>
    </section>
    <section class="lm-card">
      <span class="caption-strong muted">MODEL KEYS</span>
      <span class="body">Keys belong to your account and apply to every repository. <RouterLink to="/settings/keys">Manage keys</RouterLink></span>
    </section>
  </main>
</template>

<style scoped>
.policy {
  height: auto;
  padding: 8px 12px;
  resize: vertical;
}
</style>
