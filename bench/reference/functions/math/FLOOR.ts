import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { floorToMultiple } from '../../helpers/multiples';

/**
 * FLOOR(number, significance): rounds down to a multiple of significance. A negative
 * number with a negative significance rounds toward zero; a negative number with a
 * positive significance rounds away from zero (down).
 */
const FLOOR: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([numberValue, significanceValue]) {
    const n = toNumber(numberValue);
    if (isError(n)) return n;
    const significance = toNumber(significanceValue);
    if (isError(significance)) return significance;
    if (significance === 0) return n === 0 ? 0 : err.div0;
    if (n > 0 && significance < 0) return err.num;
    if (significance < 0) return -floorToMultiple(-n, -significance);
    return floorToMultiple(n, significance);
  },
};

export default FLOOR;
