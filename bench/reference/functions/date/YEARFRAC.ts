import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { optionalInteger } from '../../core/args';
import { isError } from '../../core/errors';
import { yearFraction } from '../../helpers/dayCount';

/** YEARFRAC(start_date, end_date, [basis]): the fraction of a year between the dates for a day-count basis (0 by default). */
const YEARFRAC: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    const start = toNumber(args[0]);
    if (isError(start)) return start;
    const end = toNumber(args[1]);
    if (isError(end)) return end;
    const basis = optionalInteger(args, 2, 0);
    if (isError(basis)) return basis;
    return yearFraction(start, end, basis);
  },
};

export default YEARFRAC;
