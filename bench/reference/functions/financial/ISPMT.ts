import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** ISPMT(rate, per, nper, pv): the interest paid in period per (from 0) of a loan repaid in even principal installments. */
const ISPMT: FormulaFunction = {
  minArgs: 4,
  maxArgs: 4,
  call([rateValue, perValue, nperValue, pvValue]) {
    const rate = toNumber(rateValue);
    if (isError(rate)) return rate;
    const per = toNumber(perValue);
    if (isError(per)) return per;
    const nper = toNumber(nperValue);
    if (isError(nper)) return nper;
    const pv = toNumber(pvValue);
    if (isError(pv)) return pv;
    if (nper === 0) return err.div0;
    return checkNumber(pv * rate * (per / nper - 1));
  },
};

export default ISPMT;
