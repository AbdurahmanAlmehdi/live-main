import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** RADIANS(number): an angle in degrees converted to radians. */
const RADIANS: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    return (n * Math.PI) / 180;
  },
};

export default RADIANS;
