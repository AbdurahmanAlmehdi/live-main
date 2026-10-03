import type { StrategyName, Task } from '@livemain/protocol';

export const STRATEGY_LABEL: Record<StrategyName | 'unknown', string> = {
  'live-main': 'Live main',
  'pr-flow': 'PR flow',
  'push-to-branch': 'Push to branch',
  unknown: 'Unknown strategy',
};

export const STRATEGY_BLURB: Record<StrategyName | 'unknown', string> = {
  'live-main': 'Shared live main, FUSE overlays, promote without retest',
  'pr-flow': 'Branch per task, rebase on conflict, merge queue',
  'push-to-branch': 'Pull --rebase and push, agent resolves conflicts',
  unknown: '',
};

const STRATEGIES: StrategyName[] = ['live-main', 'pr-flow', 'push-to-branch'];

export function strategyFromRunId(runId: string): StrategyName | undefined {
  return STRATEGIES.find((s) => runId === s || runId.startsWith(`${s}-`) || runId.startsWith(`mock-${s}`));
}

/** `run-a3-fn-SUM-17` → `a3`. Falls back to the tail of the id. */
export function agentLabel(agentId: string): string {
  const m = /-a(\d+)-/.exec(agentId);
  if (m) return `a${m[1]}`;
  if (agentId === 'external' || agentId === 'seed') return agentId;
  return agentId.length > 10 ? `…${agentId.slice(-8)}` : agentId;
}

/** `fn-SUM` → `SUM`, `helper-criteria` → `criteria`. */
export function taskLabel(taskId: string | null | undefined): string {
  if (!taskId) return '';
  const i = taskId.indexOf('-');
  return i > 0 && i < 8 ? taskId.slice(i + 1) : taskId;
}

export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
  return String(Math.round(n));
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

const CATEGORY_ORDER = ['core', 'contracts', 'helpers', 'math', 'statistical', 'text', 'logical', 'lookup', 'date', 'financial', 'information', 'engineering'];
const CATEGORY_LABEL: Record<string, string> = {
  core: 'Core contracts',
  contracts: 'Core contracts',
  helpers: 'Helpers',
  math: 'Math',
  statistical: 'Statistical',
  text: 'Text',
  logical: 'Logical',
  lookup: 'Lookup',
  date: 'Date & time',
  financial: 'Financial',
  information: 'Information',
  engineering: 'Engineering',
};

export function categoryOf(t: Task): string {
  return t.category ?? (t.kind === 'change-order' ? 'core' : t.kind === 'helper' ? 'helpers' : 'other');
}

export function categoryLabel(c: string): string {
  return CATEGORY_LABEL[c] ?? c.charAt(0).toUpperCase() + c.slice(1).replace(/[-_]/g, ' ');
}

export function categoryRank(c: string): number {
  const i = CATEGORY_ORDER.indexOf(c);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

/** Spreadsheet column letters: 0 → A, 25 → Z, 26 → AA. */
export function colLetter(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Deterministic, plausible-looking cell value for a function that now evaluates. */
export function fakeValue(name: string, category: string): string {
  let x = 2166136261;
  for (let i = 0; i < name.length; i++) x = Math.imul(x ^ name.charCodeAt(i), 16777619);
  const r = (x >>> 0) / 4294967296;
  if (category === 'logical' || name.startsWith('IS')) return r > 0.35 ? 'TRUE' : 'FALSE';
  if (category === 'text') return ['"Q3"', '"ok"', '"A-17"', '"total"', '"Live"', '"main"', '"#2"'][Math.floor(r * 7)]!;
  if (category === 'date') return String(45000 + Math.floor(r * 900));
  if (category === 'engineering' && /2(BIN|HEX|OCT)$/.test(name)) return ['"1011"', '"FF"', '"17"', '"7A"'][Math.floor(r * 4)]!;
  if (category === 'financial') return (-(r * 2400 + 120)).toFixed(2);
  const v = r * (r > 0.5 ? 1000 : 10);
  return Number.isInteger(v) ? String(v) : v.toFixed(r > 0.5 ? 1 : 3);
}
