import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** PDURATION(rate, pv, fv): the number of periods for pv to grow to fv at rate per period. */
const PDURATION: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call([rateValue, pvValue, fvValue]) {
    const rate = toNumber(rateValue);
    if (isError(rate)) return rate;
    const pv = toNumber(pvValue);
    if (isError(pv)) return pv;
    const fv = toNumber(fvValue);
    if (isError(fv)) return fv;
    if (rate <= 0 || pv <= 0 || fv <= 0) return err.num;
    return checkNumber((Math.log(fv) - Math.log(pv)) / Math.log(1 + rate));
  },
};

export default PDURATION;
