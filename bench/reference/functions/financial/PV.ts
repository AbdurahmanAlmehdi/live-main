import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { optionalInteger, optionalNumber } from '../../core/args';
import { isError } from '../../core/errors';
import { presentValue } from '../../helpers/annuity';

/** PV(rate, nper, pmt, [fv], [type]): the present value of a series of constant future payments. */
const PV: FormulaFunction = {
  minArgs: 3,
  maxArgs: 5,
  call(args) {
    const rate = toNumber(args[0]);
    if (isError(rate)) return rate;
    const nper = toNumber(args[1]);
    if (isError(nper)) return nper;
    const pmt = toNumber(args[2]);
    if (isError(pmt)) return pmt;
    const fv = optionalNumber(args, 3, 0);
    if (isError(fv)) return fv;
    const type = optionalInteger(args, 4, 0);
    if (isError(type)) return type;
    return checkNumber(presentValue(rate, nper, pmt, fv, type === 0 ? 0 : 1));
  },
};

export default PV;
