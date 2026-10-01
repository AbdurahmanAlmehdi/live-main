import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { erfc } from '../../helpers/erf';

/** ERFC(x): the complementary error function, 1 - ERF(x). */
const ERFC: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const x = toNumber(value);
    if (isError(x)) return x;
    return erfc(x);
  },
};

export default ERFC;
