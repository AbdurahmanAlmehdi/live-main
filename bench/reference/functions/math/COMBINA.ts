import type { FormulaFunction } from '../../core/types';
import { checkNumber, toInteger } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { combinations } from '../../helpers/combinatorics';

/** COMBINA(number, number_chosen): combinations with repetition, C(n + k - 1, k). */
const COMBINA: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([nValue, kValue]) {
    const n = toInteger(nValue);
    if (isError(n)) return n;
    const k = toInteger(kValue);
    if (isError(k)) return k;
    if (n < 0 || k < 0) return err.num;
    if (k === 0) return 1;
    return checkNumber(combinations(n + k - 1, k));
  },
};

export default COMBINA;
