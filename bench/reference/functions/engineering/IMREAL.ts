import type { FormulaFunction } from '../../core/types';
import { isError } from '../../core/errors';
import { parseComplex } from '../../helpers/complexParse';

/** IMREAL(inumber): the real coefficient of a complex number. */
const IMREAL: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const z = parseComplex(value);
    if (isError(z)) return z;
    return z.re;
  },
};

export default IMREAL;
