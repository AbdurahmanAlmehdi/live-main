import type { FormulaFunction } from '../../core/types';
import { checkNumber, toInteger } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** PERMUTATIONA(number, number_chosen): arrangements with repetition, number ^ number_chosen (both truncated). */
const PERMUTATIONA: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([nValue, kValue]) {
    const n = toInteger(nValue);
    if (isError(n)) return n;
    const k = toInteger(kValue);
    if (isError(k)) return k;
    if (n < 0 || k < 0) return err.num;
    return checkNumber(Math.pow(n, k));
  },
};

export default PERMUTATIONA;
