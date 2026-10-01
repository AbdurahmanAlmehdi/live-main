import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { checkNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { lcm } from '../../helpers/gcd';

/** LCM(number1, ...): the least common multiple of the (truncated) arguments. */
const LCM: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    let result = 1;
    for (const n of numbers) {
      if (n < 0) return err.num;
      result = lcm(result, Math.trunc(n));
    }
    return checkNumber(result);
  },
};

export default LCM;
