import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { dateFromSerial } from '../../helpers/dateSerial';

/** MONTH(serial_number): the month (1-12) of a date serial. */
const MONTH: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const serial = toNumber(value);
    if (isError(serial)) return serial;
    const date = dateFromSerial(serial);
    return isError(date) ? date : date.month;
  },
};

export default MONTH;
