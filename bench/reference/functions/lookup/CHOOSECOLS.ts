import type { FormulaFunction } from '../../core/types';
import { fromRows, toRange } from '../../core/range';
import { toInteger } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** CHOOSECOLS(array, num1, ...): the given columns of an array (1-based; negative numbers count from the end). */
const CHOOSECOLS: FormulaFunction = {
  minArgs: 2,
  maxArgs: Infinity,
  call([array, ...numbers]) {
    if (isError(array)) return array;
    const range = toRange(array);
    const count = range.width;
    const picked: number[] = [];
    for (const value of numbers) {
      const n = toInteger(value);
      if (isError(n)) return n;
      if (n === 0 || Math.abs(n) > count) return err.value;
      picked.push(n > 0 ? n - 1 : count + n);
    }
    return fromRows(range.rows.map((row) => picked.map((c) => row[c])));
  },
};

export default CHOOSECOLS;
