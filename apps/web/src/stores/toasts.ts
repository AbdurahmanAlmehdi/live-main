import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

/** Bottom-right, stacked, never covering the status line; errors stay until dismissed. */
export const useToasts = defineStore('toasts', () => {
  const items = ref<Toast[]>([]);
  let next = 1;
  function push(text: string, kind: Toast['kind'] = 'info') {
    const t = { id: next++, text, kind };
    items.value = [...items.value.slice(-3), t];
    if (kind === 'info') setTimeout(() => dismiss(t.id), 5000);
  }
  function dismiss(id: number) {
    items.value = items.value.filter((t) => t.id !== id);
  }
  /** Run an action; report its error as a toast instead of failing silently. */
  async function guard<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
    try {
      const v = await fn();
      if (ok) push(ok);
      return v;
    } catch (err) {
      push(err instanceof Error ? err.message : String(err), 'error');
      return undefined;
    }
  }
  return { items, push, dismiss, guard };
});
