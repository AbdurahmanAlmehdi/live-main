import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { normalInv } from '../../helpers/normal';

/** NORM.INV(probability, mean, standard_dev): the inverse of the normal cumulative distribution. */
const NORM_INV: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call([pValue, meanValue, sdValue]) {
    const p = toNumber(pValue);
    if (isError(p)) return p;
    const mean = toNumber(meanValue);
    if (isError(mean)) return mean;
    const sd = toNumber(sdValue);
    if (isError(sd)) return sd;
    if (p <= 0 || p >= 1 || sd <= 0) return err.num;
    return mean + sd * normalInv(p);
  },
};

export default NORM_INV;
