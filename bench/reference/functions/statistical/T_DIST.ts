import type { FormulaFunction } from '../../core/types';
import { toBoolean, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { gammaLn } from '../../helpers/gamma';
import { regularizedBeta } from '../../helpers/incompleteBeta';

/** T.DIST(x, deg_freedom, cumulative): the left-tailed Student t-distribution (cumulative, or the density). */
const T_DIST: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call([xValue, degreesValue, cumulativeValue]) {
    const x = toNumber(xValue);
    if (isError(x)) return x;
    const degrees = toNumber(degreesValue);
    if (isError(degrees)) return degrees;
    const cumulative = toBoolean(cumulativeValue);
    if (isError(cumulative)) return cumulative;
    if (degrees < 1) return err.num;
    if (cumulative) {
      const tail = regularizedBeta(degrees / (degrees + x * x), degrees / 2, 0.5) / 2;
      return x > 0 ? 1 - tail : tail;
    }
    const logNormalizer = gammaLn((degrees + 1) / 2) - gammaLn(degrees / 2) - 0.5 * Math.log(degrees * Math.PI);
    return Math.exp(logNormalizer - ((degrees + 1) / 2) * Math.log1p((x * x) / degrees));
  },
};

export default T_DIST;
