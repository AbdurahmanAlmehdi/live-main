import type { FormulaFunction } from '../../core/types';
import { fromRows, toRange } from '../../core/range';
import { toInteger } from '../../core/coerce';
import { optionalInteger } from '../../core/args';
import { err, isError } from '../../core/errors';

/** Index range kept after dropping `n` items from the start (n > 0) or the end (n < 0) of `size` items. */
function dropSpan(n: number, size: number): [number, number] {
  const k = Math.min(Math.abs(n), size);
  return n >= 0 ? [k, size] : [0, size - k];
}

/** DROP(array, rows, [columns]): the array without rows (and columns) at its start, or at its end when negative. */
const DROP: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    if (isError(args[0])) return args[0];
    const range = toRange(args[0]);
    const rows = toInteger(args[1]);
    if (isError(rows)) return rows;
    const cols = optionalInteger(args, 2, 0);
    if (isError(cols)) return cols;
    const [r0, r1] = dropSpan(rows, range.height);
    const [c0, c1] = dropSpan(cols, range.width);
    if (r0 >= r1 || c0 >= c1) return err.value;
    return fromRows(range.rows.slice(r0, r1).map((row) => row.slice(c0, c1)));
  },
};

export default DROP;
