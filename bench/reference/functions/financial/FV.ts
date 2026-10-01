import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { optionalInteger, optionalNumber } from '../../core/args';
import { isError } from '../../core/errors';
import { futureValue } from '../../helpers/annuity';

/** FV(rate, nper, pmt, [pv], [type]): the future value of an investment with constant payments and rate. */
const FV: FormulaFunction = {
  minArgs: 3,
  maxArgs: 5,
  call(args) {
    const rate = toNumber(args[0]);
    if (isError(rate)) return rate;
    const nper = toNumber(args[1]);
    if (isError(nper)) return nper;
    const pmt = toNumber(args[2]);
    if (isError(pmt)) return pmt;
    const pv = optionalNumber(args, 3, 0);
    if (isError(pv)) return pv;
    const type = optionalInteger(args, 4, 0);
    if (isError(type)) return type;
    return checkNumber(futureValue(rate, nper, pmt, pv, type === 0 ? 0 : 1));
  },
};

export default FV;
