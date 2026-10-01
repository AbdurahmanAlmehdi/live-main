import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { collectHolidays, isWorkday, weekendFromCode } from '../../helpers/workdays';

/**
 * NETWORKDAYS.INTL(start_date, end_date, [weekend], [holidays]): working days between the
 * dates, inclusive, with a custom weekend (1-7, 11-17, or a "0000011" mask starting Monday).
 */
const NETWORKDAYS_INTL: FormulaFunction = {
  minArgs: 2,
  maxArgs: 4,
  call(args) {
    const start = toNumber(args[0]);
    if (isError(start)) return start;
    const end = toNumber(args[1]);
    if (isError(end)) return end;
    const weekend = weekendFromCode(args[2] ?? null);
    if (isError(weekend)) return weekend;
    const holidays = collectHolidays(args[3]);
    if (isError(holidays)) return holidays;
    if (weekend.size === 7) return err.value;
    const from = Math.floor(Math.min(start, end));
    const to = Math.floor(Math.max(start, end));
    let count = 0;
    for (let day = from; day <= to; day++) {
      if (isWorkday(day, holidays, weekend)) count++;
    }
    return start <= end ? count : -count;
  },
};

export default NETWORKDAYS_INTL;
