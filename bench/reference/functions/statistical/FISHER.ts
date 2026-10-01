import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** FISHER(x): the Fisher transformation, atanh(x), for -1 < x < 1. */
const FISHER: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const x = toNumber(value);
    if (isError(x)) return x;
    if (x <= -1 || x >= 1) return err.num;
    return 0.5 * Math.log((1 + x) / (1 - x));
  },
};

export default FISHER;
