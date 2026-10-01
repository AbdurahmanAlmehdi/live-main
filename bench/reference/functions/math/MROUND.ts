import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { roundToMultiple } from '../../helpers/multiples';

/** MROUND(number, multiple): rounds to the nearest multiple; number and multiple must share a sign. */
const MROUND: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([numberValue, multipleValue]) {
    const n = toNumber(numberValue);
    if (isError(n)) return n;
    const multiple = toNumber(multipleValue);
    if (isError(multiple)) return multiple;
    if (n === 0 || multiple === 0) return 0;
    if (Math.sign(n) !== Math.sign(multiple)) return err.num;
    return roundToMultiple(n, Math.abs(multiple));
  },
};

export default MROUND;
