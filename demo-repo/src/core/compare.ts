import type { Scalar } from './value';

/**
 * Spreadsheet ordering of scalars, as used by the comparison operators (=, <, ...):
 *   numbers < text < booleans (FALSE < TRUE);
 *   text compares case-insensitively;
 *   an empty value compares like 0, "" or FALSE depending on the other side.
 * Errors are not comparable; callers must handle them first.
 */

type Comparable = number | string | boolean;

function typeRank(value: Comparable): number {
  if (typeof value === 'number') return 0;
  if (typeof value === 'string') return 1;
  return 2;
}

function blankLike(other: Comparable): Comparable {
  if (typeof other === 'number') return 0;
  if (typeof other === 'string') return '';
  return false;
}

/** -1, 0 or 1. Both arguments must be non-error scalars. */
export function compareScalars(a: Scalar, b: Scalar): -1 | 0 | 1 {
  if (a === null && b === null) return 0;
  const left = (a === null ? blankLike(b as Comparable) : a) as Comparable;
  const right = (b === null ? blankLike(a as Comparable) : b) as Comparable;
  const rankDiff = typeRank(left) - typeRank(right);
  if (rankDiff !== 0) return rankDiff < 0 ? -1 : 1;
  const l = typeof left === 'string' ? left.toLowerCase() : left;
  const r = typeof right === 'string' ? (right as string).toLowerCase() : right;
  if (l === r) return 0;
  return l < r ? -1 : 1;
}

/** Spreadsheet equality (case-insensitive for text, empty equals 0 / "" / FALSE). */
export function scalarsEqual(a: Scalar, b: Scalar): boolean {
  return compareScalars(a, b) === 0;
}
