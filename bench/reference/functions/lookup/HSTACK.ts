import type { FormulaFunction } from '../../core/types';
import type { Scalar } from '../../core/value';
import { fromRows, toRange } from '../../core/range';
import { err } from '../../core/errors';

/** HSTACK(array1, ...): the arrays placed side by side; shorter ones are padded with #N/A. */
const HSTACK: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const ranges = args.map((arg) => toRange(arg));
    const height = Math.max(...ranges.map((r) => r.height));
    const rows: Scalar[][] = [];
    for (let r = 0; r < height; r++) {
      const row: Scalar[] = [];
      for (const range of ranges) {
        for (let c = 0; c < range.width; c++) row.push(r < range.height ? range.at(r, c) : err.na);
      }
      rows.push(row);
    }
    return fromRows(rows);
  },
};

export default HSTACK;
