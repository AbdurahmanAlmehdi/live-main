import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { optionalNumber } from '../../core/args';
import { isError } from '../../core/errors';

/** DELTA(number1, [number2]): 1 when the two numbers are equal (number2 defaults to 0), 0 otherwise. */
const DELTA: FormulaFunction = {
  minArgs: 1,
  maxArgs: 2,
  call(args) {
    const a = toNumber(args[0]);
    if (isError(a)) return a;
    const b = optionalNumber(args, 1, 0);
    if (isError(b)) return b;
    return a === b ? 1 : 0;
  },
};

export default DELTA;
