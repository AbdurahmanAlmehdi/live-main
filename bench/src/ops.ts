/** Applies solution ops to a working tree on disk. */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import type { Op } from './bank.ts';

export class OpError extends Error {}

/** Converts a glob with `**` and `*` (no braces) to a RegExp over forward-slash paths. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') {
      // "**/" matches zero or more directories
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2;
      } else {
        re += '.*';
        i += 1;
      }
    } else if (ch === '*') re += '[^/]*';
    else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export function listFiles(root: string, dir = ''): string[] {
  const out: string[] = [];
  const abs = join(root, dir);
  if (!existsSync(abs)) return out;
  for (const name of readdirSync(abs).sort()) {
    if (name === 'node_modules' || name === '.git') continue;
    const rel = dir ? `${dir}/${name}` : name;
    if (statSync(join(root, rel)).isDirectory()) out.push(...listFiles(root, rel));
    else out.push(rel);
  }
  return out;
}

/** Applies a codemod to one text; exported so variants can be derived from base ops. */
export function applyCodemodToText(text: string, op: Extract<Op, { op: 'codemod' }>): string {
  return text.replace(new RegExp(op.find, op.flags), op.replace);
}

export interface ApplyResult {
  /** Files written or changed by the ops. */
  changed: string[];
}

export function applyOps(root: string, ops: readonly Op[]): ApplyResult {
  const changed = new Set<string>();
  for (const op of ops) {
    switch (op.op) {
      case 'write': {
        const abs = join(root, op.path);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, op.content);
        changed.add(op.path);
        break;
      }
      case 'insertBefore': {
        const abs = join(root, op.path);
        const text = readFileSync(abs, 'utf8');
        const lines = text.split('\n');
        const idx = lines.findIndex((l) => l.includes(op.anchor));
        if (idx < 0) throw new OpError(`insertBefore: anchor not found in ${op.path}: ${op.anchor}`);
        const before = lines.slice(0, idx).join('\n');
        const after = lines.slice(idx).join('\n');
        writeFileSync(abs, (idx > 0 ? `${before}\n` : '') + op.text + after);
        changed.add(op.path);
        break;
      }
      case 'edit': {
        const abs = join(root, op.path);
        if (!existsSync(abs)) throw new OpError(`edit: ${op.path} does not exist`);
        const text = readFileSync(abs, 'utf8');
        const first = text.indexOf(op.oldString);
        if (first < 0) throw new OpError(`edit: oldString not found in ${op.path}:\n${op.oldString.slice(0, 300)}`);
        if (text.indexOf(op.oldString, first + 1) >= 0) throw new OpError(`edit: oldString is ambiguous in ${op.path}`);
        writeFileSync(abs, text.slice(0, first) + op.newString + text.slice(first + op.oldString.length));
        changed.add(op.path);
        break;
      }
      case 'codemod': {
        const re = globToRegExp(op.glob);
        for (const file of listFiles(root)) {
          if (!re.test(file)) continue;
          const abs = join(root, file);
          const text = readFileSync(abs, 'utf8');
          const next = applyCodemodToText(text, op);
          if (next !== text) {
            writeFileSync(abs, next);
            changed.add(file);
          }
        }
        break;
      }
    }
  }
  return { changed: [...changed].sort() };
}

export function toPosix(p: string): string {
  return p.split(sep).join('/');
}

export function relPosix(from: string, to: string): string {
  return toPosix(relative(from, to));
}
