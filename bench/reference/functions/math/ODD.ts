import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** ODD(number): rounds away from zero to the nearest odd integer (ODD(0) is 1). */
const ODD: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    let magnitude = Math.ceil(Math.abs(n));
    if (magnitude % 2 === 0) magnitude += 1;
    return n < 0 ? -magnitude : magnitude;
  },
};

export default ODD;
