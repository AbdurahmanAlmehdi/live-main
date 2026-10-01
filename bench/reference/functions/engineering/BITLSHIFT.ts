import type { FormulaFunction } from '../../core/types';
import { toInteger } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { BIT_LIMIT, toBitOperand } from '../../helpers/bits';

/** Largest shift accepted, in either direction. */
const MAX_SHIFT = 53;

/** BITLSHIFT(number, shift_amount): shifts an integer left by shift_amount bits (right when negative); the result must stay below 2^48. */
const BITLSHIFT: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([numberValue, shiftValue]) {
    const n = toBitOperand(numberValue);
    if (isError(n)) return n;
    const shift = toInteger(shiftValue);
    if (isError(shift)) return shift;
    if (Math.abs(shift) > MAX_SHIFT) return err.num;
    const result = Math.floor(n * 2 ** shift);
    return result < BIT_LIMIT ? result : err.num;
  },
};

export default BITLSHIFT;
