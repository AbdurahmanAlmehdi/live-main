import type { FormulaFunction } from '../../core/types';
import { parseNumber, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { parseDateText, parseTimeText } from '../../helpers/dateParse';

/** VALUE(text): the number that text represents; dates and times give their serial numbers. */
const VALUE: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    if (typeof value !== 'string') return toNumber(value);
    const n = parseNumber(value);
    if (n !== null) return n;
    const time = parseTimeText(value);
    const date = parseDateText(value);
    if (!isError(date)) return isError(time) ? date : date + time;
    if (!isError(time)) return time;
    return err.value;
  },
};

export default VALUE;
