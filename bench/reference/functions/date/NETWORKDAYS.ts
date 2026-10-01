import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { collectHolidays, isWorkday } from '../../helpers/workdays';

/** NETWORKDAYS(start_date, end_date, [holidays]): working days between the dates, inclusive (negative when end is before start). */
const NETWORKDAYS: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    const start = toNumber(args[0]);
    if (isError(start)) return start;
    const end = toNumber(args[1]);
    if (isError(end)) return end;
    const holidays = collectHolidays(args[2]);
    if (isError(holidays)) return holidays;
    const from = Math.floor(Math.min(start, end));
    const to = Math.floor(Math.max(start, end));
    let count = 0;
    for (let day = from; day <= to; day++) {
      if (isWorkday(day, holidays)) count++;
    }
    return start <= end ? count : -count;
  },
};

export default NETWORKDAYS;
