import type { FormulaFunction } from '../../core/types';
import { toInteger, toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { endOfMonth } from '../../helpers/addMonths';

/** EOMONTH(start_date, months): the last day of the month months before or after start_date; months is truncated. */
const EOMONTH: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([startValue, monthsValue]) {
    const start = toNumber(startValue);
    if (isError(start)) return start;
    const months = toInteger(monthsValue);
    if (isError(months)) return months;
    return endOfMonth(start, months);
  },
};

export default EOMONTH;
