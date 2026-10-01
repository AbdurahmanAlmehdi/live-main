import type { FormulaFunction } from '../../core/types';
import { isError } from '../../core/errors';
import { parseComplex } from '../../helpers/complexParse';
import { formatComplex } from '../../helpers/complexFormat';

/** IMCONJUGATE(inumber): the complex conjugate of a complex number. */
const IMCONJUGATE: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const z = parseComplex(value);
    if (isError(z)) return z;
    return formatComplex({ ...z, im: -z.im });
  },
};

export default IMCONJUGATE;
