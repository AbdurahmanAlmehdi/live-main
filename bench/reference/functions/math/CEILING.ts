import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { ceilToMultiple } from '../../helpers/multiples';

/**
 * CEILING(number, significance): rounds up to a multiple of significance. A negative
 * number with a negative significance rounds away from zero; a negative number with a
 * positive significance rounds toward zero (up).
 */
const CEILING: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([numberValue, significanceValue]) {
    const n = toNumber(numberValue);
    if (isError(n)) return n;
    const significance = toNumber(significanceValue);
    if (isError(significance)) return significance;
    if (n === 0 || significance === 0) return 0;
    if (n > 0 && significance < 0) return err.num;
    if (significance < 0) return -ceilToMultiple(-n, -significance);
    return ceilToMultiple(n, significance);
  },
};

export default CEILING;
