import type { FormulaFunction } from '../../core/types';
import type { Scalar } from '../../core/value';
import { fromRows, toRange, transpose } from '../../core/range';
import { scalarsEqual } from '../../core/compare';
import { optionalBoolean } from '../../core/args';
import { err, isError } from '../../core/errors';

function sameLine(a: readonly Scalar[], b: readonly Scalar[]): boolean {
  return a.every((cell, i) => {
    const other = b[i];
    if (isError(cell) || isError(other)) return isError(cell) && isError(other) && cell.code === other.code;
    return typeof cell === typeof other && scalarsEqual(cell, other);
  });
}

/**
 * UNIQUE(array, [by_col], [exactly_once]): the distinct rows (or columns) in order of first
 * appearance; with exactly_once, only those that occur once. Text compares case-insensitively.
 */
const UNIQUE: FormulaFunction = {
  minArgs: 1,
  maxArgs: 3,
  call(args) {
    if (isError(args[0])) return args[0];
    const byCol = optionalBoolean(args, 1, false);
    if (isError(byCol)) return byCol;
    const exactlyOnce = optionalBoolean(args, 2, false);
    if (isError(exactlyOnce)) return exactlyOnce;
    const range = byCol ? transpose(toRange(args[0])) : toRange(args[0]);
    const groups: { line: Scalar[]; count: number }[] = [];
    for (const line of range.rows) {
      const group = groups.find((g) => sameLine(g.line, line));
      if (group) group.count++;
      else groups.push({ line, count: 1 });
    }
    const kept = groups.filter((g) => !exactlyOnce || g.count === 1).map((g) => g.line);
    if (kept.length === 0) return err.value;
    const result = fromRows(kept);
    return byCol ? transpose(result) : result;
  },
};

export default UNIQUE;
