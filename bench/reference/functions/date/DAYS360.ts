import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { optionalBoolean } from '../../core/args';
import { isError } from '../../core/errors';
import { days360 } from '../../helpers/dayCount';

/** DAYS360(start_date, end_date, [method]): days between two dates on a 360-day year (US method unless method is TRUE). */
const DAYS360: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    const start = toNumber(args[0]);
    if (isError(start)) return start;
    const end = toNumber(args[1]);
    if (isError(end)) return end;
    const european = optionalBoolean(args, 2, false);
    if (isError(european)) return european;
    return days360(start, end, european);
  },
};

export default DAYS360;
