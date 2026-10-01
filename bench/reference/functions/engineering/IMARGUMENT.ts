import type { FormulaFunction } from '../../core/types';
import { err, isError } from '../../core/errors';
import { parseComplex } from '../../helpers/complexParse';

/** IMARGUMENT(inumber): the argument of a complex number, in radians in (-pi, pi]; #DIV/0! for 0. */
const IMARGUMENT: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const z = parseComplex(value);
    if (isError(z)) return z;
    if (z.re === 0 && z.im === 0) return err.div0;
    return Math.atan2(z.im, z.re);
  },
};

export default IMARGUMENT;
