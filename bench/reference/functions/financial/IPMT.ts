import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { optionalInteger, optionalNumber } from '../../core/args';
import { err, isError } from '../../core/errors';
import { interestPayment } from '../../helpers/annuity';

/** IPMT(rate, per, nper, pv, [fv], [type]): the interest portion of the payment in period per (1..nper). */
const IPMT: FormulaFunction = {
  minArgs: 4,
  maxArgs: 6,
  call(args) {
    const rate = toNumber(args[0]);
    if (isError(rate)) return rate;
    const per = toNumber(args[1]);
    if (isError(per)) return per;
    const nper = toNumber(args[2]);
    if (isError(nper)) return nper;
    const pv = toNumber(args[3]);
    if (isError(pv)) return pv;
    const fv = optionalNumber(args, 4, 0);
    if (isError(fv)) return fv;
    const type = optionalInteger(args, 5, 0);
    if (isError(type)) return type;
    if (per < 1 || per > nper) return err.num;
    return checkNumber(interestPayment(rate, per, nper, pv, fv, type === 0 ? 0 : 1));
  },
};

export default IPMT;
