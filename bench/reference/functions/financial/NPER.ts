import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { optionalInteger, optionalNumber } from '../../core/args';
import { err, isError } from '../../core/errors';

/** NPER(rate, pmt, pv, [fv], [type]): the number of periods needed to go from pv to fv with constant payments. */
const NPER: FormulaFunction = {
  minArgs: 3,
  maxArgs: 5,
  call(args) {
    const rate = toNumber(args[0]);
    if (isError(rate)) return rate;
    const pmt = toNumber(args[1]);
    if (isError(pmt)) return pmt;
    const pv = toNumber(args[2]);
    if (isError(pv)) return pv;
    const fv = optionalNumber(args, 3, 0);
    if (isError(fv)) return fv;
    const type = optionalInteger(args, 4, 0);
    if (isError(type)) return type;
    if (rate === 0) {
      if (pmt === 0) return err.num;
      return checkNumber(-(pv + fv) / pmt);
    }
    const adjusted = pmt * (1 + rate * (type === 0 ? 0 : 1));
    const ratio = (adjusted - fv * rate) / (adjusted + pv * rate);
    if (!(ratio > 0)) return err.num;
    return checkNumber(Math.log(ratio) / Math.log(1 + rate));
  },
};

export default NPER;
