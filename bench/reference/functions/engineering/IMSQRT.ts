import type { FormulaFunction } from '../../core/types';
import { isError } from '../../core/errors';
import { parseComplex } from '../../helpers/complexParse';
import { formatComplex } from '../../helpers/complexFormat';

/** IMSQRT(inumber): the principal square root of a complex number, computed in polar form. */
const IMSQRT: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const z = parseComplex(value);
    if (isError(z)) return z;
    const modulus = Math.sqrt(Math.hypot(z.re, z.im));
    const angle = Math.atan2(z.im, z.re) / 2;
    return formatComplex({ re: modulus * Math.cos(angle), im: modulus * Math.sin(angle), suffix: z.suffix });
  },
};

export default IMSQRT;
