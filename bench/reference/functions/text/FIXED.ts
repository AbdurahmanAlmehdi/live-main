import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { optionalBoolean, optionalInteger } from '../../core/args';
import { err, isError } from '../../core/errors';
import { formatFixed } from '../../helpers/fixedFormat';

/** FIXED(number, [decimals], [no_commas]): the number as text with decimals (2 by default). */
const FIXED: FormulaFunction = {
  minArgs: 1,
  maxArgs: 3,
  call(args) {
    const n = toNumber(args[0]);
    if (isError(n)) return n;
    const decimals = optionalInteger(args, 1, 2);
    if (isError(decimals)) return decimals;
    const noCommas = optionalBoolean(args, 2, false);
    if (isError(noCommas)) return noCommas;
    if (decimals > 127) return err.value;
    return formatFixed(n, decimals, !noCommas);
  },
};

export default FIXED;
