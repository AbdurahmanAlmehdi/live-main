import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { optionalInteger } from '../../core/args';
import { err, isError } from '../../core/errors';
import { weekOfYear } from '../../helpers/weekday';

/** First day of the week (0 = Sunday) for each return_type. */
const WEEK_STARTS: Record<number, number> = { 1: 0, 2: 1, 11: 1, 12: 2, 13: 3, 14: 4, 15: 5, 16: 6, 17: 0 };

/** WEEKNUM(serial_number, [return_type]): the week of the year; the week containing January 1 is week 1. */
const WEEKNUM: FormulaFunction = {
  minArgs: 1,
  maxArgs: 2,
  call(args) {
    const serial = toNumber(args[0]);
    if (isError(serial)) return serial;
    const returnType = optionalInteger(args, 1, 1);
    if (isError(returnType)) return returnType;
    const weekStart = WEEK_STARTS[returnType];
    if (weekStart === undefined) return err.num;
    return weekOfYear(serial, weekStart);
  },
};

export default WEEKNUM;
