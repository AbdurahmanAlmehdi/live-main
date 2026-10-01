import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { optionalNumber } from '../../core/args';
import { err, isError } from '../../core/errors';

/** LOG(number, [base]): the logarithm of a number to a base (10 by default). */
const LOG: FormulaFunction = {
  minArgs: 1,
  maxArgs: 2,
  call(args) {
    const n = toNumber(args[0]);
    if (isError(n)) return n;
    const base = optionalNumber(args, 1, 10);
    if (isError(base)) return base;
    if (n <= 0 || base <= 0) return err.num;
    if (base === 1) return err.div0;
    return Math.log(n) / Math.log(base);
  },
};

export default LOG;
