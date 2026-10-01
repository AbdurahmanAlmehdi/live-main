import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { checkNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { combinations } from '../../helpers/combinatorics';

/** MULTINOMIAL(number1, ...): (n1 + n2 + ...)! / (n1! n2! ...), arguments truncated. */
const MULTINOMIAL: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    let total = 0;
    let result = 1;
    for (const raw of numbers) {
      const n = Math.trunc(raw);
      if (n < 0) return err.num;
      total += n;
      // build the multinomial as a product of binomials to stay exact longer
      result *= combinations(total, n);
    }
    return checkNumber(result);
  },
};

export default MULTINOMIAL;
