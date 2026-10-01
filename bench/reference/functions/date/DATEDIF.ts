import type { FormulaFunction } from '../../core/types';
import { toNumber, toText } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { dateFromSerial, serialFromDate } from '../../helpers/dateSerial';

/**
 * DATEDIF(start_date, end_date, unit): complete years "Y", months "M" or days "D" between
 * the dates, or the remaining days "MD", months "YM" or days "YD" ignoring larger units.
 */
const DATEDIF: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call([startValue, endValue, unitValue]) {
    const start = toNumber(startValue);
    if (isError(start)) return start;
    const end = toNumber(endValue);
    if (isError(end)) return end;
    const unitText = toText(unitValue);
    if (isError(unitText)) return unitText;
    if (start > end) return err.num;
    const a = dateFromSerial(start);
    if (isError(a)) return a;
    const b = dateFromSerial(end);
    if (isError(b)) return b;
    let months = (b.year - a.year) * 12 + (b.month - a.month);
    if (b.day < a.day) months--;
    switch (unitText.toUpperCase()) {
      case 'Y':
        return Math.floor(months / 12);
      case 'M':
        return months;
      case 'D':
        return Math.floor(end) - Math.floor(start);
      case 'MD': {
        if (b.day >= a.day) return b.day - a.day;
        const previousMonth = serialFromDate(b.year, b.month, 0) as number;
        const lastDay = dateFromSerial(previousMonth);
        return isError(lastDay) ? lastDay : lastDay.day - a.day + b.day;
      }
      case 'YM':
        return months % 12;
      case 'YD': {
        const sameYear = serialFromDate(b.year, a.month, a.day) as number;
        const anchor = sameYear > Math.floor(end) ? (serialFromDate(b.year - 1, a.month, a.day) as number) : sameYear;
        return Math.floor(end) - anchor;
      }
      default:
        return err.num;
    }
  },
};

export default DATEDIF;
