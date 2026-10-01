import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { isoWeekOfYear } from '../../helpers/weekday';

/** ISOWEEKNUM(date): the ISO 8601 week number (weeks start on Monday; week 1 holds the year's first Thursday). */
const ISOWEEKNUM: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const serial = toNumber(value);
    if (isError(serial)) return serial;
    return isoWeekOfYear(serial);
  },
};

export default ISOWEEKNUM;
