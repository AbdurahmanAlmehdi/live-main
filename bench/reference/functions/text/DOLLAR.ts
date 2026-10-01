import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { optionalInteger } from '../../core/args';
import { err, isError } from '../../core/errors';
import { formatFixed } from '../../helpers/fixedFormat';

/** DOLLAR(number, [decimals]): currency text such as "$1,234.57"; negative amounts in parentheses. */
const DOLLAR: FormulaFunction = {
  minArgs: 1,
  maxArgs: 2,
  call(args) {
    const n = toNumber(args[0]);
    if (isError(n)) return n;
    const decimals = optionalInteger(args, 1, 2);
    if (isError(decimals)) return decimals;
    if (decimals > 127) return err.value;
    const text = formatFixed(Math.abs(n), decimals, true);
    return n < 0 && /[1-9]/.test(text) ? `($${text})` : `$${text}`;
  },
};

export default DOLLAR;
