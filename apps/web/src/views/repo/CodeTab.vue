<script setup lang="ts">
import type { FileView } from '@livemain/protocol';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CodeView from '@/components/lm/CodeView.vue';
import FileTree from '@/components/lm/FileTree.vue';
import LmIcon from '@/components/lm/LmIcon.vue';
import SegControl from '@/components/lm/SegControl.vue';
import StateBox from '@/components/lm/StateBox.vue';
import VersionPill from '@/components/lm/VersionPill.vue';
import { api } from '@/lib/api';
import { agentName, ago, plural, splitPath } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { useRepo } from '@/stores/repo';

const repo = useRepo();
const route = useRoute();
const router = useRouter();
const now = useNow();

const path = computed(() => (typeof route.params.path === 'string' && route.params.path ? route.params.path : null));
const file = ref<FileView | null>(null);
const fileError = ref<string | null>(null);
const view = ref<'notes' | 'code'>('notes');

const defaultPath = computed(() => {
  const t = repo.tree ?? [];
  return t.find((e) => e.path === 'README.md')?.path ?? t.find((e) => e.type === 'file' && !e.path.includes('/'))?.path ?? t.find((e) => e.type === 'file')?.path ?? null;
});
const shown = computed(() => path.value ?? defaultPath.value);

async function loadFile() {
  const p = shown.value;
  if (!p) return;
  try {
    file.value = await api.file(repo.owner, repo.name, p);
    fileError.value = null;
  } catch (err) {
    fileError.value = err instanceof Error ? err.message : String(err);
    file.value = null;
  }
}

watch(() => repo.repo?.id, () => void repo.loadTree(true), { immediate: true });
watch(shown, () => void loadFile(), { immediate: true });

// Live: when main moves or overlays change, refresh the tree and the open file (throttled).
let pending: ReturnType<typeof setTimeout> | null = null;
watch(
  () => [repo.mainTick, repo.treeStale] as const,
  () => {
    if (pending) return;
    pending = setTimeout(async () => {
      pending = null;
      await repo.loadTree();
      await loadFile();
    }, 1500);
  },
);

function open(p: string) {
  void router.push(`${repo.base}/blob/${p}`);
}
const name = computed(() => (file.value ? splitPath(file.value.path) : null));
const allAdditive = computed(() => file.value && file.value.notes.length > 0 && file.value.notes.every((n) => n.class === 'additive'));
async function copyPath() {
  if (file.value) await navigator.clipboard.writeText(file.value.path).catch(() => undefined);
}
</script>

<template>
  <main class="lm-page">
    <div class="lm-workspace">
      <FileTree v-if="repo.tree" :entries="repo.tree" :selected="shown" :version="repo.repo?.main?.version" @open="open" />
      <StateBox v-else kind="loading" title="Loading files…" />
      <div class="lm-filepane">
        <StateBox v-if="fileError" kind="error" :title="`Couldn’t open ${shown}`">{{ fileError }}</StateBox>
        <StateBox v-else-if="!shown && repo.tree" title="This repository is empty">Push a first commit, or dispatch agents to write one.</StateBox>
        <template v-else-if="file && name">
          <div class="lm-filehead">
            <div class="row-3">
              <h2 class="mono-title">{{ name.name }}</h2>
              <span v-if="name.dir" class="mono-sm muted">{{ name.dir }}</span>
              <button type="button" class="lm-iconbtn" aria-label="Copy path" title="Copy path" @click="copyPath"><LmIcon name="copy" /></button>
              <span class="grow" />
              <SegControl v-model="view" label="Show" :options="[{ value: 'notes', label: 'Main + notes' }, { value: 'code', label: 'Code only' }]" />
            </div>
            <div class="row-3 caption">
              <span>As on main <VersionPill :version="file.version" kind="main" /></span>
              <span v-if="file.lastLanding" class="muted">Last landed in v{{ file.lastLanding.version }} · {{ file.lastLanding.title }} · {{ ago(file.lastLanding.at, now) }} ago</span>
              <span class="muted">{{ plural(file.lines, 'line') }}</span>
            </div>
            <div v-if="file.writers.length || file.readers" class="lm-overlaybar">
              <span v-if="file.writers.length" class="mk-w"><LmIcon name="written" />{{ file.writers.length }} agent{{ file.writers.length === 1 ? ' is' : 's are' }} changing this file</span>
              <span v-if="file.readers" class="mk-r"><LmIcon name="read" />{{ file.readers }} ha{{ file.readers === 1 ? 's' : 've' }} read it</span>
              <span v-if="allAdditive" class="muted caption">all {{ file.notes.length }} changes are additive and will merge automatically</span>
              <span v-else-if="file.writers.length" class="muted caption">{{ file.writers.map((w) => agentName(w.agentId)).join(', ') }}</span>
            </div>
          </div>
          <CodeView :file="file" :show-margin="view === 'notes'" :agent-link="(id) => `${repo.base}/agents/${encodeURIComponent(id)}`" />
        </template>
        <StateBox v-else kind="loading" title="Loading file…" />
      </div>
    </div>
  </main>
</template>
