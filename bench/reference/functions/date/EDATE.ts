import type { FormulaFunction } from '../../core/types';
import { toInteger, toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { addMonths } from '../../helpers/addMonths';

/** EDATE(start_date, months): the date months months before or after start_date (clamped to shorter months); months is truncated. */
const EDATE: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([startValue, monthsValue]) {
    const start = toNumber(startValue);
    if (isError(start)) return start;
    const months = toInteger(monthsValue);
    if (isError(months)) return months;
    return addMonths(start, months);
  },
};

export default EDATE;
