import type { FormulaFunction } from '../../core/types';
import { toInteger } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { toRoman } from '../../helpers/roman';

/** ROMAN(number): a number from 0 to 3999 (truncated) as a classic roman numeral. */
const ROMAN: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toInteger(value);
    if (isError(n)) return n;
    if (n < 0 || n > 3999) return err.value;
    return toRoman(n);
  },
};

export default ROMAN;
