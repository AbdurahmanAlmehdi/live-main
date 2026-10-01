import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** RRI(nper, pv, fv): the equivalent rate per period for pv to grow to fv over nper periods. */
const RRI: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call([nperValue, pvValue, fvValue]) {
    const nper = toNumber(nperValue);
    if (isError(nper)) return nper;
    const pv = toNumber(pvValue);
    if (isError(pv)) return pv;
    const fv = toNumber(fvValue);
    if (isError(fv)) return fv;
    if (nper <= 0) return err.num;
    return checkNumber(Math.pow(fv / pv, 1 / nper) - 1);
  },
};

export default RRI;
