import type { FormulaFunction } from '../../core/types';
import { checkNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { collectPairs } from '../../helpers/pairs';

/** SUMXMY2(array_x, array_y): the sum of (x − y)² over corresponding values (pairs with a non-number are skipped). */
const SUMXMY2: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([left, right]) {
    const pairs = collectPairs(left, right);
    if (isError(pairs)) return pairs;
    let total = 0;
    pairs.xs.forEach((x, i) => {
      const y = pairs.ys[i];
      total += (x - y) * (x - y);
    });
    return checkNumber(total);
  },
};

export default SUMXMY2;
