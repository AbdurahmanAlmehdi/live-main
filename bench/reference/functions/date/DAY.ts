import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { dateFromSerial } from '../../helpers/dateSerial';

/** DAY(serial_number): the day of the month (1-31) of a date serial. */
const DAY: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const serial = toNumber(value);
    if (isError(serial)) return serial;
    const date = dateFromSerial(serial);
    return isError(date) ? date : date.day;
  },
};

export default DAY;
