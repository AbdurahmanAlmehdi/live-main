import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** FISHERINV(y): the inverse Fisher transformation, tanh(y). */
const FISHERINV: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const y = toNumber(value);
    if (isError(y)) return y;
    return Math.tanh(y);
  },
};

export default FISHERINV;
