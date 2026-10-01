import type { FormulaFunction } from '../../core/types';
import { toBoolean, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { normalCdf, normalPdf } from '../../helpers/normal';

/** LOGNORM.DIST(x, mean, standard_dev, cumulative): the lognormal distribution of x > 0, where ln(x) has the given mean and standard deviation. */
const LOGNORM_DIST: FormulaFunction = {
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
    if (x <= 0 || sd <= 0) return err.num;
    const z = (Math.log(x) - mean) / sd;
    return cumulative ? normalCdf(z) : normalPdf(z) / (x * sd);
  },
};

export default LOGNORM_DIST;
