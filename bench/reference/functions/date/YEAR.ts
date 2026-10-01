import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { dateFromSerial } from '../../helpers/dateSerial';

/** YEAR(serial_number): the year of a date serial. */
const YEAR: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const serial = toNumber(value);
    if (isError(serial)) return serial;
    const date = dateFromSerial(serial);
    return isError(date) ? date : date.year;
  },
};

export default YEAR;
