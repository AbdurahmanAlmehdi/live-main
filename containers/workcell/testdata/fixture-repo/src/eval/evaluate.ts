import type { Value } from '../core/value';
import { registry } from '../core/registry';

function parseArg(raw: string): Value {
  const s = raw.trim();
  if (s === '') return null;
  if (s === 'TRUE') return true;
  if (s === 'FALSE') return false;
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  return Number(s);
}

/** Evaluates a single call like `=SUM(1,2,3)`. Unknown functions give #NAME?. */
export async function evaluate(formula: string): Promise<Value> {
  const m = /^=([A-Z][A-Z0-9.]*)\((.*)\)$/.exec(formula.trim());
  if (!m) return '#VALUE!';
  const load = registry[m[1]];
  if (!load) return '#NAME?';
  const fn = (await load()).default;
  const args = m[2].trim() === '' ? [] : m[2].split(',').map(parseArg);
  return fn(args);
}
