import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { gammaLn } from '../../helpers/gamma';

/** GAMMALN(x): the natural logarithm of the gamma function, for x > 0. */
const GAMMALN: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const x = toNumber(value);
    if (isError(x)) return x;
    if (x <= 0) return err.num;
    return gammaLn(x);
  },
};

export default GAMMALN;
