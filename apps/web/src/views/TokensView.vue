<script setup lang="ts">
import type { CreatedGitToken, GitToken } from '@livemain/protocol';
import { computed, onMounted, ref } from 'vue';
import CliInline from '@/components/lm/CliInline.vue';
import LmIcon from '@/components/lm/LmIcon.vue';
import StateBox from '@/components/lm/StateBox.vue';
import { api } from '@/lib/api';
import { ago } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { useSession } from '@/stores/session';
import { useToasts } from '@/stores/toasts';

/** Personal git tokens: the password for `git` against Live Main's git remotes. Shown once. */
const toasts = useToasts();
const session = useSession();
const now = useNow();
const tokens = ref<GitToken[] | null>(null);
const name = ref('');
const busy = ref(false);
const created = ref<CreatedGitToken | null>(null);

const example = computed(() => session.repos?.[0]?.cloneUrl ?? `${location.origin}/git/<owner>/<repo>.git`);

onMounted(async () => {
  tokens.value = (await toasts.guard(() => api.tokens())) ?? [];
  if (!session.repos) await session.loadRepos();
});

async function create() {
  busy.value = true;
  const t = await toasts.guard(() => api.createToken(name.value.trim()));
  busy.value = false;
  if (!t) return;
  created.value = t;
  tokens.value = [t.info, ...(tokens.value ?? [])];
  name.value = '';
}

async function revoke(t: GitToken) {
  const ok = await toasts.guard(() => api.revokeToken(t.id), `Token “${t.name}” revoked.`);
  if (ok) tokens.value = (tokens.value ?? []).filter((x) => x.id !== t.id);
}
</script>

<template>
  <main class="lm-page is-narrow">
    <div class="stack-2">
      <h1 class="title-lg">Git tokens</h1>
      <p class="body muted">
        Clone, fetch and push with plain <span class="mono-sm">git</span>: use a token as the password (any username). A push to main does not move main directly; it lands through Live Main like an agent’s work: newer main is merged in, tests already on main run first, and agents reading the files you changed are told.
      </p>
    </div>

    <form class="lm-key" @submit.prevent="create">
      <span class="body-strong">New token</span>
      <span class="row-2">
        <input v-model="name" class="lm-input" maxlength="64" placeholder="What is it for? e.g. laptop" aria-label="Token name" />
        <button type="submit" class="lm-btn is-primary" :disabled="busy || !name.trim()"><LmIcon name="plus" />{{ busy ? 'Creating…' : 'Create token' }}</button>
      </span>
    </form>

    <section v-if="created" class="lm-card" aria-live="polite">
      <span class="caption-strong muted">YOUR NEW TOKEN · SHOWN ONCE</span>
      <CliInline :command="created.token" :short="created.token" />
      <span class="caption muted">Copy it now; it is stored only as a hash. Then, for example:</span>
      <CliInline :command="`git clone ${example}`" />
      <span class="caption muted">When git asks, enter any username and the token as the password (a credential helper remembers it). Push to change order: <span class="mono-sm">git push -o change-order</span>.</span>
      <span><button type="button" class="lm-btn is-ghost is-sm" @click="created = null">Done</button></span>
    </section>

    <StateBox v-if="tokens === null" kind="loading" title="Loading tokens…" :rows="2" />
    <p v-else-if="tokens.length === 0" class="body muted">No tokens yet.</p>
    <ul v-else class="lm-list">
      <li v-for="t in tokens" :key="t.id">
        <LmIcon name="key" />
        <span class="body-strong">{{ t.name }}</span>
        <span class="mono-sm muted">lm_…{{ t.last4 }}</span>
        <span class="grow" />
        <span class="caption muted">created {{ ago(t.createdAt, now) }} ago · {{ t.lastUsedAt ? `used ${ago(t.lastUsedAt, now)} ago` : 'never used' }}</span>
        <button type="button" class="lm-btn is-ghost is-sm" @click="revoke(t)">Revoke</button>
      </li>
    </ul>
  </main>
</template>
