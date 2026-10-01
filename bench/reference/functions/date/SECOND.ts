import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { timeFromSerial } from '../../helpers/timeOfDay';

/** SECOND(serial_number): the second (0-59) of a time serial. */
const SECOND: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const serial = toNumber(value);
    if (isError(serial)) return serial;
    const time = timeFromSerial(serial);
    return isError(time) ? time : time.second;
  },
};

export default SECOND;
