import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { err, firstError } from '../../core/errors';

/** QUOTIENT(numerator, denominator): the integer part of a division, truncated toward zero. */
const QUOTIENT: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call(args) {
    const numbers = args.map((arg) => toNumber(arg));
    const error = firstError(...numbers);
    if (error) return error;
    const [numerator, denominator] = numbers as number[];
    if (denominator === 0) return err.div0;
    return checkNumber(Math.trunc(numerator / denominator));
  },
};

export default QUOTIENT;
