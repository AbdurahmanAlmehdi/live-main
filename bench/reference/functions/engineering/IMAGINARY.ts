import type { FormulaFunction } from '../../core/types';
import { isError } from '../../core/errors';
import { parseComplex } from '../../helpers/complexParse';

/** IMAGINARY(inumber): the imaginary coefficient of a complex number. */
const IMAGINARY: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const z = parseComplex(value);
    if (isError(z)) return z;
    return z.im;
  },
};

export default IMAGINARY;
