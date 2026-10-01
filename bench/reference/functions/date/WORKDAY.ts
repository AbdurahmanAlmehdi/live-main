import type { FormulaFunction } from '../../core/types';
import { toInteger, toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { collectHolidays, isWorkday } from '../../helpers/workdays';

/** WORKDAY(start_date, days, [holidays]): the date `days` working days after (or before) start_date. */
const WORKDAY: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    const start = toNumber(args[0]);
    if (isError(start)) return start;
    const days = toInteger(args[1]);
    if (isError(days)) return days;
    const holidays = collectHolidays(args[2]);
    if (isError(holidays)) return holidays;
    const step = days < 0 ? -1 : 1;
    let day = Math.floor(start);
    for (let remaining = Math.abs(days); remaining > 0; ) {
      day += step;
      if (isWorkday(day, holidays)) remaining--;
    }
    return day;
  },
};

export default WORKDAY;
