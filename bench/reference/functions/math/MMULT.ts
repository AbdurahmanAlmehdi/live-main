import type { FormulaFunction } from '../../core/types';
import type { Scalar } from '../../core/value';
import { fromRows, toRange } from '../../core/range';
import { checkNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** MMULT(array1, array2): the matrix product; every cell must be a number. */
const MMULT: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([left, right]) {
    if (isError(left)) return left;
    if (isError(right)) return right;
    const a = toRange(left);
    const b = toRange(right);
    if (a.width !== b.height) return err.value;
    const rows: Scalar[][] = [];
    for (let r = 0; r < a.height; r++) {
      const row: Scalar[] = [];
      for (let c = 0; c < b.width; c++) {
        let total = 0;
        for (let k = 0; k < a.width; k++) {
          const x = a.at(r, k);
          const y = b.at(k, c);
          if (isError(x)) return x;
          if (isError(y)) return y;
          if (typeof x !== 'number' || typeof y !== 'number') return err.value;
          total += x * y;
        }
        row.push(checkNumber(total));
      }
      rows.push(row);
    }
    return fromRows(rows);
  },
};

export default MMULT;
