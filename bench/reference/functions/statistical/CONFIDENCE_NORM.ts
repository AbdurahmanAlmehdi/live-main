import type { FormulaFunction } from '../../core/types';
import { toInteger, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { normalInv } from '../../helpers/normal';

/** CONFIDENCE.NORM(alpha, standard_dev, size): the half-width of a normal confidence interval for a mean (size is truncated). */
const CONFIDENCE_NORM: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call([alphaValue, sdValue, sizeValue]) {
    const alpha = toNumber(alphaValue);
    if (isError(alpha)) return alpha;
    const sd = toNumber(sdValue);
    if (isError(sd)) return sd;
    const size = toInteger(sizeValue);
    if (isError(size)) return size;
    if (alpha <= 0 || alpha >= 1 || sd <= 0 || size < 1) return err.num;
    return (normalInv(1 - alpha / 2) * sd) / Math.sqrt(size);
  },
};

export default CONFIDENCE_NORM;
