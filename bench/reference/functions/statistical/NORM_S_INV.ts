import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { normalInv } from '../../helpers/normal';

/** NORM.S.INV(probability): the inverse of the standard normal cumulative distribution. */
const NORM_S_INV: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([pValue]) {
    const p = toNumber(pValue);
    if (isError(p)) return p;
    if (p <= 0 || p >= 1) return err.num;
    return normalInv(p);
  },
};

export default NORM_S_INV;
