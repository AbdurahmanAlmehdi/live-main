import type { KeyInfo, ProviderId, Repo, Session } from '@livemain/protocol';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, type TemplateInfo } from '@/lib/api';

export const useSession = defineStore('session', () => {
  const session = ref<Session | null>(null);
  const templates = ref<TemplateInfo[]>([]);
  const repos = ref<Repo[] | null>(null);
  const keys = ref<KeyInfo[] | null>(null);
  const error = ref<string | null>(null);

  async function load() {
    try {
      [session.value, templates.value] = await Promise.all([api.session(), api.templates()]);
      error.value = null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  }
  async function loadRepos() {
    repos.value = await api.repos();
  }
  async function loadKeys() {
    keys.value = await api.keys();
  }
  function upsertKey(k: KeyInfo) {
    keys.value = [...(keys.value ?? []).filter((x) => x.provider !== k.provider), k].sort((a, b) => a.provider.localeCompare(b.provider));
  }
  async function removeKey(p: ProviderId) {
    await api.deleteKey(p);
    keys.value = (keys.value ?? []).filter((k) => k.provider !== p);
  }
  return { session, templates, repos, keys, error, load, loadRepos, loadKeys, upsertKey, removeKey };
});
