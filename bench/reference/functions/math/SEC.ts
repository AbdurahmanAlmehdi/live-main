import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** SEC(number): the secant of an angle in radians. */
const SEC: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    return checkNumber(1 / Math.cos(n));
  },
};

export default SEC;
