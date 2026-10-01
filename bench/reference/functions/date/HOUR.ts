import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { timeFromSerial } from '../../helpers/timeOfDay';

/** HOUR(serial_number): the hour (0-23) of a time serial. */
const HOUR: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const serial = toNumber(value);
    if (isError(serial)) return serial;
    const time = timeFromSerial(serial);
    return isError(time) ? time : time.hour;
  },
};

export default HOUR;
