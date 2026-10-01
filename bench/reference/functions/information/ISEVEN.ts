import type { FormulaFunction } from '../../core/types';
import { toInteger } from '../../core/coerce';
import { isError } from '../../core/errors';

/** ISEVEN(number): TRUE when the number, truncated to an integer, is even. */
const ISEVEN: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toInteger(value);
    if (isError(n)) return n;
    return Math.abs(n) % 2 === 0;
  },
};

export default ISEVEN;
