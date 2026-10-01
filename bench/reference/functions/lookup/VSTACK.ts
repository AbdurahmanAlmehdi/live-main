import type { FormulaFunction } from '../../core/types';
import type { Scalar } from '../../core/value';
import { fromRows, toRange } from '../../core/range';
import { err } from '../../core/errors';

/** VSTACK(array1, ...): the arrays stacked top to bottom; narrower ones are padded with #N/A. */
const VSTACK: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const ranges = args.map((arg) => toRange(arg));
    const width = Math.max(...ranges.map((r) => r.width));
    const rows: Scalar[][] = [];
    for (const range of ranges) {
      for (const row of range.rows) rows.push([...row, ...Array<Scalar>(width - row.length).fill(err.na)]);
    }
    return fromRows(rows);
  },
};

export default VSTACK;
