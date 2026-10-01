import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** DEGREES(number): an angle in radians converted to degrees. */
const DEGREES: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    return (n * 180) / Math.PI;
  },
};

export default DEGREES;
