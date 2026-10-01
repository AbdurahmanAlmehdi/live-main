import type { FormulaFunction } from '../../core/types';
import { toBoolean, toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { normalCdf, normalPdf } from '../../helpers/normal';

/** NORM.S.DIST(z, cumulative): the standard normal distribution (cumulative, or the density when cumulative is FALSE). */
const NORM_S_DIST: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([zValue, cumulativeValue]) {
    const z = toNumber(zValue);
    if (isError(z)) return z;
    const cumulative = toBoolean(cumulativeValue);
    if (isError(cumulative)) return cumulative;
    return cumulative ? normalCdf(z) : normalPdf(z);
  },
};

export default NORM_S_DIST;
