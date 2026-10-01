import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { gamma } from '../../helpers/gamma';

/** GAMMA(number): the gamma function; #NUM! at 0, the negative integers and on overflow. */
const GAMMA: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const x = toNumber(value);
    if (isError(x)) return x;
    return checkNumber(gamma(x));
  },
};

export default GAMMA;
