import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** EVEN(number): rounds away from zero to the nearest even integer. */
const EVEN: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    const magnitude = Math.ceil(Math.abs(n) / 2) * 2;
    return n < 0 ? -magnitude : magnitude;
  },
};

export default EVEN;
