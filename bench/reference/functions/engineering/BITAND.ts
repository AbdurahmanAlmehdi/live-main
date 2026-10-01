import type { FormulaFunction } from '../../core/types';
import { isError } from '../../core/errors';
import { toBitOperand } from '../../helpers/bits';

/** BITAND(number1, number2): the bitwise AND of two integers in 0..2^48-1. */
const BITAND: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([aValue, bValue]) {
    const a = toBitOperand(aValue);
    if (isError(a)) return a;
    const b = toBitOperand(bValue);
    if (isError(b)) return b;
    return Number(BigInt(a) & BigInt(b));
  },
};

export default BITAND;
