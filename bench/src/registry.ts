import { fileNameOf } from '../defs/types.ts';

const IDENT = /^[A-Z_][A-Z0-9_]*$/;

/** The registry entry a leaf task adds, e.g. "  SUM: () => import('../functions/math/SUM'),\n". */
export function registryLine(name: string, category: string): string {
  const key = IDENT.test(name) ? name : `'${name}'`;
  return `  ${key}: () => import('../functions/${category}/${fileNameOf(name)}'),\n`;
}

export function functionPath(name: string, category: string): string {
  return `src/functions/${category}/${fileNameOf(name)}.ts`;
}
