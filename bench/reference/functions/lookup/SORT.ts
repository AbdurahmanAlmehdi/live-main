import type { FormulaFunction } from '../../core/types';
import type { Scalar } from '../../core/value';
import { fromRows, toRange, transpose } from '../../core/range';
import { compareScalars } from '../../core/compare';
import { optionalBoolean, optionalInteger } from '../../core/args';
import { err, isError } from '../../core/errors';

/** Sort key order: numbers, text, booleans, then errors and empty cells last. */
function compareCells(a: Scalar, b: Scalar): number {
  const aLast = a === null || isError(a);
  const bLast = b === null || isError(b);
  if (aLast || bLast) return Number(aLast) - Number(bLast);
  return compareScalars(a, b);
}

/**
 * SORT(array, [sort_index], [sort_order], [by_col]): the rows (or columns, with by_col) of an
 * array sorted by the sort_index-th column (or row); sort_order 1 ascending, -1 descending.
 */
const SORT: FormulaFunction = {
  minArgs: 1,
  maxArgs: 4,
  call(args) {
    if (isError(args[0])) return args[0];
    const sortIndex = optionalInteger(args, 1, 1);
    if (isError(sortIndex)) return sortIndex;
    const order = optionalInteger(args, 2, 1);
    if (isError(order)) return order;
    const byCol = optionalBoolean(args, 3, false);
    if (isError(byCol)) return byCol;
    const range = byCol ? transpose(toRange(args[0])) : toRange(args[0]);
    if (sortIndex < 1 || sortIndex > range.width) return err.value;
    if (order !== 1 && order !== -1) return err.value;
    const sorted = [...range.rows].sort((a, b) => order * compareCells(a[sortIndex - 1], b[sortIndex - 1]));
    const result = fromRows(sorted);
    return byCol ? transpose(result) : result;
  },
};

export default SORT;
