import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { optionalInteger, optionalNumber } from '../../core/args';
import { err, isError } from '../../core/errors';
import { payment } from '../../helpers/annuity';

/** PMT(rate, nper, pv, [fv], [type]): the constant periodic payment of a loan or investment. */
const PMT: FormulaFunction = {
  minArgs: 3,
  maxArgs: 5,
  call(args) {
    const rate = toNumber(args[0]);
    if (isError(rate)) return rate;
    const nper = toNumber(args[1]);
    if (isError(nper)) return nper;
    const pv = toNumber(args[2]);
    if (isError(pv)) return pv;
    const fv = optionalNumber(args, 3, 0);
    if (isError(fv)) return fv;
    const type = optionalInteger(args, 4, 0);
    if (isError(type)) return type;
    if (nper === 0) return err.num;
    return checkNumber(payment(rate, nper, pv, fv, type === 0 ? 0 : 1));
  },
};

export default PMT;
