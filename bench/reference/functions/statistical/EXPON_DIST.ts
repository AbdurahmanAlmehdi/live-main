import type { FormulaFunction } from '../../core/types';
import { toBoolean, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** EXPON.DIST(x, lambda, cumulative): the exponential distribution with rate lambda (cumulative, or the density). */
const EXPON_DIST: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call([xValue, lambdaValue, cumulativeValue]) {
    const x = toNumber(xValue);
    if (isError(x)) return x;
    const lambda = toNumber(lambdaValue);
    if (isError(lambda)) return lambda;
    const cumulative = toBoolean(cumulativeValue);
    if (isError(cumulative)) return cumulative;
    if (x < 0 || lambda <= 0) return err.num;
    return cumulative ? -Math.expm1(-lambda * x) : lambda * Math.exp(-lambda * x);
  },
};

export default EXPON_DIST;
