import type { FormulaFunction } from '../../core/types';
import { fromRows, toRange } from '../../core/range';
import { toInteger } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** Index range kept by taking `n` items from the start (n > 0) or the end (n < 0) of `size` items. */
function takeSpan(n: number, size: number): [number, number] {
  const k = Math.min(Math.abs(n), size);
  return n >= 0 ? [0, k] : [size - k, size];
}

/** TAKE(array, rows, [columns]): rows (and columns) from the start of the array, or from the end when negative. */
const TAKE: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    if (isError(args[0])) return args[0];
    const range = toRange(args[0]);
    const rows = toInteger(args[1]);
    if (isError(rows)) return rows;
    const cols = args.length > 2 && args[2] !== null ? toInteger(args[2]) : range.width;
    if (isError(cols)) return cols;
    if (rows === 0 || cols === 0) return err.value;
    const [r0, r1] = takeSpan(rows, range.height);
    const [c0, c1] = takeSpan(cols, range.width);
    return fromRows(range.rows.slice(r0, r1).map((row) => row.slice(c0, c1)));
  },
};

export default TAKE;
