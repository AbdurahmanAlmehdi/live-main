import type { FormulaFunction } from '../../core/types';
import { toBoolean, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { normalCdf, normalPdf } from '../../helpers/normal';

/** NORM.DIST(x, mean, standard_dev, cumulative): the normal distribution (cumulative, or the density when cumulative is FALSE). */
const NORM_DIST: FormulaFunction = {
  minArgs: 4,
  maxArgs: 4,
  call([xValue, meanValue, sdValue, cumulativeValue]) {
    const x = toNumber(xValue);
    if (isError(x)) return x;
    const mean = toNumber(meanValue);
    if (isError(mean)) return mean;
    const sd = toNumber(sdValue);
    if (isError(sd)) return sd;
    const cumulative = toBoolean(cumulativeValue);
    if (isError(cumulative)) return cumulative;
    if (sd <= 0) return err.num;
    const z = (x - mean) / sd;
    return cumulative ? normalCdf(z) : normalPdf(z) / sd;
  },
};

export default NORM_DIST;
