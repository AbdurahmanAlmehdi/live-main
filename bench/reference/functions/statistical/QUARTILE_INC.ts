import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { toInteger } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { percentileInclusive } from '../../helpers/quantile';

/** QUARTILE.INC(array, quart): quartile 0 (minimum) to 4 (maximum); quart is truncated. */
const QUARTILE_INC: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([array, quartValue]) {
    const numbers = collectNumbers([array]);
    if (isError(numbers)) return numbers;
    const quart = toInteger(quartValue);
    if (isError(quart)) return quart;
    if (quart < 0 || quart > 4) return err.num;
    return percentileInclusive(numbers, quart / 4);
  },
};

export default QUARTILE_INC;
