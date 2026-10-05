import { PROVIDERS, type AgentState, type Worker } from '@livemain/protocol';

export const STATE_LABEL: Record<AgentState, string> = {
  queued: 'queued',
  working: 'working',
  testing: 'testing',
  checkpointing: 'checkpointing',
  interrupted: 'interrupted',
  guarded: 'guarded',
  ready: 'ready to land',
  landed: 'landed',
  'gave-up': 'gave up',
  stopped: 'stopped',
  error: 'error',
};

/** "now", "40 s", "2 min", "3 h", "Oct 2". */
export function ago(at: number | null | undefined, now = Date.now()): string {
  if (!at) return '';
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return 'now';
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86_400) return `${Math.round(s / 3600)} h`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function duration(ms: number): string {
  const m = Math.round(ms / 60_000);
  return m < 1 ? `${Math.max(1, Math.round(ms / 1000))} s` : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

export const usd = (n: number) => `$${n.toFixed(2)}`;

/** Agent ids are `<swarm>-a<slot>-<task>-<attempt>`; people call them by slot: a7. */
export function agentName(id: string): string {
  const m = /-a(\d+)-/.exec(id);
  return m ? `a${m[1]}` : id.slice(0, 8);
}

const MODEL_NAMES: Record<string, string> = {
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
  'claude-opus-5-5': 'Claude Opus 5.5',
  'claude-fable-5-1': 'Claude Fable 5.1',
};

export function modelName(model: string): string {
  const base = Object.keys(MODEL_NAMES).find((k) => model === k || model.startsWith(`${k}-`));
  return base ? MODEL_NAMES[base]! : model;
}

export function workerLabel(w: Worker | null | undefined): { provider: string; model: string } {
  if (!w) return { provider: '', model: '' };
  if (w.kind === 'model') return { provider: PROVIDERS[w.provider].label, model: modelName(w.model) };
  if (w.kind === 'external') return { provider: 'External', model: w.name };
  return { provider: 'Replay', model: 'reference solution' };
}

export function workerText(w: Worker | null | undefined): string {
  const l = workerLabel(w);
  return l.provider ? `${l.provider} · ${l.model}` : '';
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function splitPath(path: string): { dir: string; name: string } {
  const i = path.lastIndexOf('/');
  return i < 0 ? { dir: '', name: path } : { dir: path.slice(0, i + 1), name: path.slice(i + 1) };
}
