import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { optionalInteger } from '../../core/args';
import { isError } from '../../core/errors';
import { weekdayOf } from '../../helpers/weekday';

/** WEEKDAY(serial_number, [return_type]): the day of the week, numbered per return_type (1 by default). */
const WEEKDAY: FormulaFunction = {
  minArgs: 1,
  maxArgs: 2,
  call(args) {
    const serial = toNumber(args[0]);
    if (isError(serial)) return serial;
    const returnType = optionalInteger(args, 1, 1);
    if (isError(returnType)) return returnType;
    return weekdayOf(serial, returnType);
  },
};

export default WEEKDAY;
