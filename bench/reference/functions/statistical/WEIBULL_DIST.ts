import type { FormulaFunction } from '../../core/types';
import { checkNumber, toBoolean, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** WEIBULL.DIST(x, alpha, beta, cumulative): the Weibull distribution with shape alpha and scale beta (cumulative, or the density). */
const WEIBULL_DIST: FormulaFunction = {
  minArgs: 4,
  maxArgs: 4,
  call([xValue, alphaValue, betaValue, cumulativeValue]) {
    const x = toNumber(xValue);
    if (isError(x)) return x;
    const alpha = toNumber(alphaValue);
    if (isError(alpha)) return alpha;
    const beta = toNumber(betaValue);
    if (isError(beta)) return beta;
    const cumulative = toBoolean(cumulativeValue);
    if (isError(cumulative)) return cumulative;
    if (x < 0 || alpha <= 0 || beta <= 0) return err.num;
    const scaled = (x / beta) ** alpha;
    if (cumulative) return -Math.expm1(-scaled);
    return checkNumber((alpha / beta) * (x / beta) ** (alpha - 1) * Math.exp(-scaled));
  },
};

export default WEIBULL_DIST;
