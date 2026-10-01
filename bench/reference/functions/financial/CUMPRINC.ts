import type { FormulaFunction } from '../../core/types';
import { checkNumber, toInteger, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { interestPayment, payment } from '../../helpers/annuity';

/**
 * CUMPRINC(rate, nper, pv, start_period, end_period, type): the total principal repaid on
 * a loan from start_period to end_period (inclusive). Periods and type are truncated.
 */
const CUMPRINC: FormulaFunction = {
  minArgs: 6,
  maxArgs: 6,
  call([rateValue, nperValue, pvValue, startValue, endValue, typeValue]) {
    const rate = toNumber(rateValue);
    if (isError(rate)) return rate;
    const nper = toNumber(nperValue);
    if (isError(nper)) return nper;
    const pv = toNumber(pvValue);
    if (isError(pv)) return pv;
    const start = toInteger(startValue);
    if (isError(start)) return start;
    const end = toInteger(endValue);
    if (isError(end)) return end;
    const type = toInteger(typeValue);
    if (isError(type)) return type;
    if (rate <= 0 || nper <= 0 || pv <= 0) return err.num;
    if (start < 1 || start > end || end > nper || (type !== 0 && type !== 1)) return err.num;
    const pmt = payment(rate, nper, pv, 0, type);
    let total = 0;
    for (let per = start; per <= end; per++) total += pmt - interestPayment(rate, per, nper, pv, 0, type);
    return checkNumber(total);
  },
};

export default CUMPRINC;
