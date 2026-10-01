import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** EXP(number): e raised to the power of a number. */
const EXP: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    return checkNumber(Math.exp(n));
  },
};

export default EXP;
