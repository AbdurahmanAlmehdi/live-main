import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** TAN(number): the tangent of an angle in radians. */
const TAN: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    return Math.tan(n);
  },
};

export default TAN;
