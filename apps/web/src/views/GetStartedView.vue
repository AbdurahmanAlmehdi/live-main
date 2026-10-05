<script setup lang="ts">
import { PROVIDERS, type ProviderId, type Repo } from '@livemain/protocol';
import { computed, onMounted, ref } from 'vue';
import CliBlock from '@/components/lm/CliBlock.vue';
import KeyField from '@/components/lm/KeyField.vue';
import LmIcon from '@/components/lm/LmIcon.vue';
import StatusChip from '@/components/lm/StatusChip.vue';
import { api } from '@/lib/api';
import { useSession } from '@/stores/session';
import { useToasts } from '@/stores/toasts';

const session = useSession();
const toasts = useToasts();
onMounted(() => session.loadKeys());

type Source = 'template' | 'empty' | 'import' | 'github';
const source = ref<Source>('template');
const name = ref('formula-engine');
const description = ref('');
const url = ref('');
const busy = ref(false);
const created = ref<Repo | null>(null);
const nameOk = computed(() => /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name.value));
const template = computed(() => session.templates[0]);

function pick(s: Source) {
  source.value = s;
  if (s === 'template' && !name.value) name.value = 'formula-engine';
}

async function create() {
  busy.value = true;
  const from =
    source.value === 'template'
      ? { kind: 'template' as const, template: template.value?.id ?? 'formula-engine' }
      : source.value === 'import'
        ? { kind: 'import' as const, url: url.value.trim() }
        : { kind: 'empty' as const };
  const repo = await toasts.guard(() => api.createRepo({ name: name.value, description: description.value || undefined, from }));
  busy.value = false;
  if (!repo) return;
  created.value = repo;
  await session.loadRepos();
}

const providers = Object.keys(PROVIDERS) as ProviderId[];
const keyed = computed(() => (session.keys ?? []).filter((k) => k.test?.ok).length);
const base = computed(() => (created.value ? `/${created.value.owner}/${created.value.name}` : ''));
const origin = location.origin;
const cliRepo = computed(() => (created.value ? created.value.fullName : `${session.session?.org ?? 'you'}/${name.value}`));
</script>

<template>
  <main class="lm-page is-narrow">
    <div class="stack-2">
      <h1 class="title-lg">Get started</h1>
      <p class="body muted">A repository with a live main, your model keys, and the CLI. Then dispatch a swarm and watch it land.</p>
    </div>

    <section class="lm-section" aria-labelledby="step-1">
      <div class="row-3">
        <StatusChip bare :state="created ? 'landed' : 'working'" :label="created ? 'done' : 'step 1'" />
        <h2 id="step-1" class="title">Create a repository</h2>
      </div>
      <template v-if="!created">
        <div class="lm-grid-2">
          <button type="button" class="lm-choice" :aria-pressed="source === 'template'" @click="pick('template')">
            <span class="row-2"><LmIcon name="swarms" /><span class="body-strong">Start from the demo</span></span>
            <span class="caption muted">{{ template?.description ?? 'Demo repository with tasks' }}. Replays its reference solutions, so it runs without model keys.</span>
          </button>
          <button type="button" class="lm-choice" :aria-pressed="source === 'empty'" @click="pick('empty')">
            <span class="row-2"><LmIcon name="repo" /><span class="body-strong">Empty repository</span></span>
            <span class="caption muted">Hosted on Live Main, starting with a README. Add tasks and dispatch agents; clone it any time.</span>
          </button>
          <button type="button" class="lm-choice" :aria-pressed="source === 'import'" @click="pick('import')">
            <span class="row-2"><LmIcon name="external" /><span class="body-strong">Import by URL</span></span>
            <span class="caption muted">Copies a public git repository’s default branch into a new live main.</span>
          </button>
          <button type="button" class="lm-choice" disabled aria-disabled="true">
            <span class="row-2"><LmIcon name="landing-push" /><span class="body-strong">Connect a GitHub repository</span></span>
            <span class="caption">Needs the Live Main GitHub App, which this installation has not set up. Landings would come back as one updating pull request. Import by URL meanwhile.</span>
          </button>
        </div>
        <form class="lm-card" @submit.prevent="create">
          <label class="lm-field" :class="{ 'is-error': name && !nameOk }">
            <span class="body-strong">Name</span>
            <input v-model="name" class="lm-input" required aria-describedby="name-help" />
            <span id="name-help" class="caption" :class="nameOk || !name ? 'muted' : 'lm-error-text'">{{ nameOk || !name ? `${session.session?.org ?? ''}/${name}` : 'Letters, digits, dot, dash or underscore.' }}</span>
          </label>
          <label v-if="source === 'import'" class="lm-field">
            <span class="body-strong">Git URL</span>
            <input v-model="url" class="lm-input" type="url" required placeholder="https://github.com/owner/repo.git" />
          </label>
          <label v-if="source !== 'template'" class="lm-field">
            <span class="body-strong">Description <span class="muted">(optional)</span></span>
            <input v-model="description" class="lm-input" placeholder="What agents should know this codebase is" />
          </label>
          <div class="row-3">
            <button type="submit" class="lm-btn is-primary" :disabled="busy || !nameOk || (source === 'import' && !url)">{{ busy ? 'Creating…' : 'Create repository' }}</button>
            <span class="caption muted">{{ source === 'template' ? 'Seeds the stubbed engine and its tasks.' : '' }}</span>
          </div>
        </form>
      </template>
      <div v-else class="lm-card">
        <div class="row-3"><LmIcon name="repo" /><RouterLink :to="base" class="body-strong">{{ created.fullName }}</RouterLink><span class="lm-ver is-main">main v{{ created.main?.version }}</span></div>
        <code class="mono-sm muted">git clone {{ created.cloneUrl }}</code>
      </div>
    </section>

    <section class="lm-section" aria-labelledby="step-2">
      <div class="row-3">
        <StatusChip bare :state="keyed ? 'landed' : 'queued'" :label="keyed ? `${keyed} key${keyed === 1 ? '' : 's'} working` : 'step 2'" />
        <h2 id="step-2" class="title">Add a model key</h2>
      </div>
      <p class="body muted">Agents run on your own keys: Anthropic, OpenAI, Google Gemini, OpenRouter, or any OpenAI-compatible endpoint. {{ source === 'template' ? 'The demo can skip this: it replays reference solutions.' : '' }}</p>
      <div v-if="session.keys" class="stack-3">
        <KeyField v-for="p in providers" :key="p" :provider="p" :info="session.keys.find((k) => k.provider === p)" />
      </div>
    </section>

    <section class="lm-section" aria-labelledby="step-3">
      <div class="row-3"><StatusChip bare state="queued" label="step 3" /><h2 id="step-3" class="title">Connect the CLI and Claude Code</h2></div>
      <p class="body muted">Install <code class="mono-sm">lm</code> from the repository (<code class="mono-sm">pnpm --filter @livemain/cli build &amp;&amp; npm install -g ./apps/cli</code>). Its commands map onto this API, so every page shows the command for what it does; <code class="mono-sm">lm mcp</code> lets Claude Code dispatch swarms and work tasks as an agent.</p>
      <CliBlock label="Sign in, clone, and expose Live Main to Claude Code as MCP tools" :command="`lm auth login --host ${origin}\nlm clone ${cliRepo}\nclaude mcp add livemain -- lm mcp`" />
    </section>

    <section class="lm-section" aria-labelledby="step-4">
      <div class="row-3"><StatusChip bare :state="created ? 'ready' : 'queued'" label="step 4" /><h2 id="step-4" class="title">Dispatch your first swarm</h2></div>
      <div class="row-3">
        <RouterLink v-if="created" :to="`${base}/dispatch`" class="lm-btn is-primary is-lg"><LmIcon name="play" />Dispatch a swarm</RouterLink>
        <button v-else type="button" class="lm-btn is-primary is-lg" disabled>Dispatch a swarm</button>
        <span class="caption muted">{{ created ? 'Pick tasks, choose models, set a budget.' : 'Create the repository first.' }}</span>
      </div>
    </section>
  </main>
</template>
