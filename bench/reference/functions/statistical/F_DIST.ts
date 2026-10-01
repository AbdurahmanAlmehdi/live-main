import type { FormulaFunction } from '../../core/types';
import { checkNumber, toBoolean, toInteger, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { gammaLn } from '../../helpers/gamma';
import { regularizedBeta } from '../../helpers/incompleteBeta';

/** F.DIST(x, deg_freedom1, deg_freedom2, cumulative): the left-tailed F distribution (degrees of freedom are truncated). */
const F_DIST: FormulaFunction = {
  minArgs: 4,
  maxArgs: 4,
  call([xValue, d1Value, d2Value, cumulativeValue]) {
    const x = toNumber(xValue);
    if (isError(x)) return x;
    const d1 = toInteger(d1Value);
    if (isError(d1)) return d1;
    const d2 = toInteger(d2Value);
    if (isError(d2)) return d2;
    const cumulative = toBoolean(cumulativeValue);
    if (isError(cumulative)) return cumulative;
    if (x < 0 || d1 < 1 || d2 < 1) return err.num;
    if (cumulative) return regularizedBeta((d1 * x) / (d1 * x + d2), d1 / 2, d2 / 2);
    if (x === 0) return d1 === 2 ? 1 : d1 > 2 ? 0 : err.num;
    const logBeta = gammaLn(d1 / 2) + gammaLn(d2 / 2) - gammaLn((d1 + d2) / 2);
    const logDensity = (d1 / 2) * Math.log(d1 / d2) + (d1 / 2 - 1) * Math.log(x) - ((d1 + d2) / 2) * Math.log1p((d1 * x) / d2) - logBeta;
    return checkNumber(Math.exp(logDensity));
  },
};

export default F_DIST;
