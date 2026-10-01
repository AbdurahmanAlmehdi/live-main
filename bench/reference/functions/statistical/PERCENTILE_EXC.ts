import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { percentileExclusive } from '../../helpers/quantile';

/** PERCENTILE.EXC(array, k): the k-th percentile, 0 < k < 1 (exclusive), interpolated. */
const PERCENTILE_EXC: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([array, kValue]) {
    const numbers = collectNumbers([array]);
    if (isError(numbers)) return numbers;
    const k = toNumber(kValue);
    if (isError(k)) return k;
    return percentileExclusive(numbers, k);
  },
};

export default PERCENTILE_EXC;
