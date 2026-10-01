import type { FormulaFunction } from '../../core/types';
import { toInteger } from '../../core/coerce';
import { firstError } from '../../core/errors';
import { serialFromDate } from '../../helpers/dateSerial';

/** DATE(year, month, day): the serial number of a date (arguments truncated; out-of-range months and days roll over). */
const DATE: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call(args) {
    const parts = args.map((arg) => toInteger(arg));
    const error = firstError(...parts);
    if (error) return error;
    const [year, month, day] = parts as number[];
    return serialFromDate(year, month, day);
  },
};

export default DATE;
