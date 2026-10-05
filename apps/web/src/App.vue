<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CommandPalette, { type Command } from '@/components/lm/CommandPalette.vue';
import LmIcon from '@/components/lm/LmIcon.vue';
import ToastStack from '@/components/lm/ToastStack.vue';
import { agentName } from '@/lib/format';
import { useRepo } from '@/stores/repo';
import { useSession } from '@/stores/session';

const session = useSession();
const repo = useRepo();
const route = useRoute();
const router = useRouter();
const palette = ref(false);

onMounted(async () => {
  await session.load();
  await session.loadRepos().catch(() => undefined);
});

const inRepo = computed(() => typeof route.params.owner === 'string' && typeof route.params.name === 'string');

// Theme: follow the OS unless the person picked one (stored per browser).
type Theme = 'system' | 'light' | 'dark';
const theme = ref<Theme>((document.documentElement.dataset.theme as Theme | undefined) ?? 'system');
function cycleTheme() {
  theme.value = theme.value === 'system' ? 'light' : theme.value === 'light' ? 'dark' : 'system';
  if (theme.value === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme.value;
  try {
    if (theme.value === 'system') localStorage.removeItem('lm-theme');
    else localStorage.setItem('lm-theme', theme.value);
  } catch {
    // storage blocked: the choice lasts for this page only
  }
}

const commands = computed<Command[]>(() => {
  const out: Command[] = [];
  if (inRepo.value) {
    const b = repo.base;
    out.push(
      { group: 'This repository', label: 'Dispatch a swarm', icon: 'play', hint: 'D', run: `${b}/dispatch` },
      { group: 'This repository', label: 'Code', icon: 'code', hint: 'G C', run: b },
      { group: 'This repository', label: 'Main (landings)', icon: 'main', hint: 'G M', run: `${b}/main` },
      { group: 'This repository', label: 'Swarms', icon: 'swarms', hint: 'G S', run: `${b}/swarms` },
      { group: 'This repository', label: 'Agents', icon: 'agents', hint: 'G A', run: `${b}/agents` },
      { group: 'This repository', label: 'Tasks', icon: 'tasks', hint: 'G T', run: `${b}/tasks` },
    );
    for (const a of repo.activeAgents.slice(0, 20)) out.push({ group: 'Agents', label: `${agentName(a.id)} · ${a.taskTitle}`, icon: 'agents', hint: a.state, run: `${b}/agents/${encodeURIComponent(a.id)}` });
  }
  for (const r of session.repos ?? []) out.push({ group: 'Repositories', label: r.fullName, icon: 'repo', run: `/${r.owner}/${r.name}` });
  out.push(
    { group: 'Go to', label: 'New repository', icon: 'plus', run: '/new' },
    { group: 'Go to', label: 'Model keys', icon: 'key', run: '/settings/keys' },
    { group: 'Go to', label: 'Git tokens', icon: 'terminal', run: '/settings/tokens' },
    { group: 'Go to', label: `Theme: ${theme.value} (switch)`, icon: 'settings', run: cycleTheme },
  );
  return out;
});

// Keyboard: ⌘K palette; G then a letter for tabs; D to dispatch (not while typing).
let pendingG = 0;
function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    palette.value = !palette.value;
    return;
  }
  const t = e.target as HTMLElement | null;
  if (palette.value || e.metaKey || e.ctrlKey || e.altKey || (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)))) return;
  if (!inRepo.value) return;
  const k = e.key.toLowerCase();
  const b = repo.base;
  if (Date.now() - pendingG < 1200) {
    const to = { c: b, m: `${b}/main`, s: `${b}/swarms`, a: `${b}/agents`, t: `${b}/tasks`, r: `${b}/approvals` }[k];
    pendingG = 0;
    if (to) void router.push(to);
    return;
  }
  if (k === 'g') pendingG = Date.now();
  else if (k === 'd') void router.push(`${b}/dispatch`);
}
onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <a href="#main" class="lm-skip lm-btn is-primary">Skip to content</a>
  <header class="lm-global">
    <RouterLink to="/" class="lm-brand"><span class="lm-brand-mark" aria-hidden="true" />Live Main</RouterLink>
    <span v-if="inRepo" class="lm-crumbs body"><span class="muted">/</span><span class="muted">{{ route.params.owner }}</span><span class="muted">/</span><RouterLink :to="repo.base" class="body-strong">{{ route.params.name }}</RouterLink></span>
    <span class="grow" />
    <button type="button" class="lm-searchbtn" aria-label="Open command palette (⌘K)" @click="palette = true"><LmIcon name="search" /><span>Jump to…</span><kbd class="lm-kbd">⌘K</kbd></button>
    <RouterLink to="/settings/keys" class="lm-iconbtn is-boxed" aria-label="Model keys" title="Model keys"><LmIcon name="key" /></RouterLink>
    <RouterLink to="/settings/tokens" class="lm-iconbtn is-boxed" aria-label="Git tokens" title="Git tokens"><LmIcon name="terminal" /></RouterLink>
    <button type="button" class="lm-iconbtn is-boxed" :aria-label="`Theme: ${theme}`" :title="`Theme: ${theme} (click to switch)`" @click="cycleTheme"><LmIcon name="settings" /></button>
    <span v-if="session.session" class="caption muted lm-user" :title="session.session.mode === 'local' ? 'Local installation' : ''">{{ session.session.user.login }}</span>
  </header>
  <div v-if="session.error" class="lm-page is-narrow">
    <div class="lm-state is-error" role="alert">
      <LmIcon name="error" :size="20" />
      <div class="title-sm">Can’t reach the Live Main API</div>
      <p class="body">{{ session.error }}. Start it with <code class="mono-sm">pnpm livemain serve</code>, then reload.</p>
    </div>
  </div>
  <RouterView v-else id="main" />
  <ToastStack />
  <CommandPalette v-model="palette" :commands="commands" />
</template>
