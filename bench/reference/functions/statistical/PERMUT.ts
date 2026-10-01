import type { FormulaFunction } from '../../core/types';
import { checkNumber, toInteger } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { permutations } from '../../helpers/combinatorics';

/** PERMUT(number, number_chosen): ordered arrangements of number_chosen items out of number (both truncated). */
const PERMUT: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([nValue, kValue]) {
    const n = toInteger(nValue);
    if (isError(n)) return n;
    const k = toInteger(kValue);
    if (isError(k)) return k;
    if (n < 0 || k < 0 || k > n) return err.num;
    return checkNumber(permutations(n, k));
  },
};

export default PERMUT;
