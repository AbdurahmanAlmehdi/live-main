import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { err, isError } from '../../core/errors';
import { gcd } from '../../helpers/gcd';

/** GCD(number1, ...): the greatest common divisor of the (truncated) arguments. */
const GCD: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    let result = 0;
    for (const n of numbers) {
      if (n < 0) return err.num;
      result = gcd(result, Math.trunc(n));
    }
    return result;
  },
};

export default GCD;
