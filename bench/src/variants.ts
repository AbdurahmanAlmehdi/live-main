/**
 * Deriving solution variants from change-order codemods.
 *
 * A task written after change order C lands must already use C's new contract. Because C's
 * codemods are exactly how C rewrites existing call sites, the variant of a solution for a
 * set S of landed change orders is the base solution with S's codemods applied (in release
 * order) to the text the solution writes. build-bank emits one variant per subset of the
 * change orders that actually touch the solution.
 */
import type { ChangeOrderDef } from '../defs/change-orders.ts';
import type { Op, Variant } from './bank.ts';
import { applyCodemodToText, globToRegExp } from './ops.ts';

type Codemod = Extract<Op, { op: 'codemod' }>;

function codemodText(path: string, text: string, codemods: readonly Codemod[]): string {
  let out = text;
  for (const cm of codemods) {
    if (globToRegExp(cm.glob).test(path)) out = applyCodemodToText(out, cm);
  }
  return out;
}

/** Applies the codemods of `cos` (in the given order) to the text carried by `ops`. */
export function transformOps(ops: readonly Op[], cos: readonly ChangeOrderDef[]): Op[] {
  const codemods = cos.flatMap((co) => co.codemods);
  if (codemods.length === 0) return ops.map((op) => ({ ...op }));
  return ops.map((op): Op => {
    switch (op.op) {
      case 'write':
        return { ...op, content: codemodText(op.path, op.content, codemods) };
      case 'edit':
        return { ...op, oldString: codemodText(op.path, op.oldString, codemods), newString: codemodText(op.path, op.newString, codemods) };
      case 'insertBefore':
        return { ...op, text: codemodText(op.path, op.text, codemods) };
      case 'codemod':
        return { ...op };
    }
  });
}

function sameOps(a: readonly Op[], b: readonly Op[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function subsets<T>(items: readonly T[]): T[][] {
  const out: T[][] = [[]];
  for (const item of items) {
    const n = out.length;
    for (let i = 0; i < n; i++) out.push([...out[i], item]);
  }
  return out;
}

export interface VariantResult {
  variants: Variant[];
  /** Change orders that change this solution. */
  relevant: string[];
  problems: string[];
}

/**
 * All variants of `base` for the change orders in `allCos` (sorted by release). `exclude`
 * leaves out a change order's own id when deriving variants of that change order.
 */
export function deriveVariants(base: readonly Op[], allCos: readonly ChangeOrderDef[], exclude?: string): VariantResult {
  const cos = allCos.filter((co) => co.id !== exclude);
  const relevant = new Set<string>();
  // closure: a change order is relevant if it changes the ops under some combination of relevant ones
  for (let changed = true; changed; ) {
    changed = false;
    const known = cos.filter((co) => relevant.has(co.id));
    for (const subset of subsets(known)) {
      const before = transformOps(base, subset);
      for (const co of cos) {
        if (relevant.has(co.id)) continue;
        const ordered = cos.filter((c) => c === co || subset.includes(c));
        if (!sameOps(before, transformOps(base, ordered))) {
          relevant.add(co.id);
          changed = true;
        }
      }
    }
  }
  const rel = cos.filter((co) => relevant.has(co.id));
  const problems: string[] = [];
  // codemods must commute, because change orders may land in any order in a real run
  for (const a of rel) {
    for (const b of rel) {
      if (a.id >= b.id) continue;
      if (!sameOps(transformOps(base, [a, b]), transformOps(base, [b, a]))) problems.push(`codemods of ${a.id} and ${b.id} do not commute`);
    }
  }
  const variants: Variant[] = subsets(rel).map((subset) => {
    const ops = transformOps(base, subset);
    for (const co of subset) {
      for (const op of ops) {
        const texts = op.op === 'write' ? [op.content] : op.op === 'edit' ? [op.newString] : op.op === 'insertBefore' ? [op.text] : [];
        if (texts.some((t) => co.residue.test(t))) problems.push(`variant [${subset.map((c) => c.id).join(',')}] still uses the API ${co.id} removed (${op.op} ${'path' in op ? op.path : ''})`);
      }
    }
    return { requires: subset.map((c) => c.id), ops };
  });
  return { variants, relevant: rel.map((c) => c.id), problems };
}
