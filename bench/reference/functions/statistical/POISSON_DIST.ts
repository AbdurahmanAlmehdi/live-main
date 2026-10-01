import type { FormulaFunction } from '../../core/types';
import { toBoolean, toInteger, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { gammaLn } from '../../helpers/gamma';
import { regularizedGammaQ } from '../../helpers/incompleteGamma';

/** POISSON.DIST(x, mean, cumulative): the Poisson distribution of x events (truncated): P(X <= x) or P(X = x). */
const POISSON_DIST: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call([xValue, meanValue, cumulativeValue]) {
    const x = toInteger(xValue);
    if (isError(x)) return x;
    const mean = toNumber(meanValue);
    if (isError(mean)) return mean;
    const cumulative = toBoolean(cumulativeValue);
    if (isError(cumulative)) return cumulative;
    if (x < 0 || mean < 0) return err.num;
    if (cumulative) return regularizedGammaQ(x + 1, mean);
    if (x === 0) return Math.exp(-mean);
    return Math.exp(x * Math.log(mean) - mean - gammaLn(x + 1));
  },
};

export default POISSON_DIST;
