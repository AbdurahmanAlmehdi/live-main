import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** ACOT(number): the arccotangent of a number, in (0, pi). */
const ACOT: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    return Math.PI / 2 - Math.atan(n);
  },
};

export default ACOT;
