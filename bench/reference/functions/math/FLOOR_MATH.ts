import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { optionalNumber } from '../../core/args';
import { isError } from '../../core/errors';
import { ceilToMultiple, floorToMultiple } from '../../helpers/multiples';

/**
 * FLOOR.MATH(number, [significance], [mode]): rounds down to a multiple of |significance|
 * (1 by default). Negative numbers round away from zero, or toward zero when mode is
 * non-zero.
 */
const FLOOR_MATH: FormulaFunction = {
  minArgs: 1,
  maxArgs: 3,
  call(args) {
    const n = toNumber(args[0]);
    if (isError(n)) return n;
    const significance = optionalNumber(args, 1, 1);
    if (isError(significance)) return significance;
    const mode = optionalNumber(args, 2, 0);
    if (isError(mode)) return mode;
    const step = Math.abs(significance);
    if (n === 0 || step === 0) return 0;
    if (n < 0 && mode !== 0) return ceilToMultiple(n, step);
    return floorToMultiple(n, step);
  },
};

export default FLOOR_MATH;
