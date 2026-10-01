import type { FormulaFunction } from '../../core/types';
import { checkNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { collectPairs } from '../../helpers/pairs';

/** SUMX2MY2(array_x, array_y): the sum of x² − y² over corresponding values (pairs with a non-number are skipped). */
const SUMX2MY2: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([left, right]) {
    const pairs = collectPairs(left, right);
    if (isError(pairs)) return pairs;
    let total = 0;
    pairs.xs.forEach((x, i) => {
      const y = pairs.ys[i];
      total += x * x - y * y;
    });
    return checkNumber(total);
  },
};

export default SUMX2MY2;
