import type { FormulaFunction } from '../../core/types';
import { checkNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { parseComplex } from '../../helpers/complexParse';

/** IMABS(inumber): the modulus |z| of a complex number. */
const IMABS: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const z = parseComplex(value);
    if (isError(z)) return z;
    return checkNumber(Math.hypot(z.re, z.im));
  },
};

export default IMABS;
