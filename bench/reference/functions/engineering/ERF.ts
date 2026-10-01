import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { erf } from '../../helpers/erf';

/** ERF(lower_limit, [upper_limit]): the error function integrated from 0 to lower_limit, or from lower_limit to upper_limit. */
const ERF: FormulaFunction = {
  minArgs: 1,
  maxArgs: 2,
  call(args) {
    const lower = toNumber(args[0]);
    if (isError(lower)) return lower;
    if (args.length < 2) return erf(lower);
    const upper = toNumber(args[1]);
    if (isError(upper)) return upper;
    return erf(upper) - erf(lower);
  },
};

export default ERF;
