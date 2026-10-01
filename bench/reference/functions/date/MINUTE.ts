import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { timeFromSerial } from '../../helpers/timeOfDay';

/** MINUTE(serial_number): the minute (0-59) of a time serial. */
const MINUTE: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const serial = toNumber(value);
    if (isError(serial)) return serial;
    const time = timeFromSerial(serial);
    return isError(time) ? time : time.minute;
  },
};

export default MINUTE;
