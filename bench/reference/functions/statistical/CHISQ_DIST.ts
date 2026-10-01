import type { FormulaFunction } from '../../core/types';
import { checkNumber, toBoolean, toInteger, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { gammaLn } from '../../helpers/gamma';
import { regularizedGammaP } from '../../helpers/incompleteGamma';

/** Largest number of degrees of freedom accepted. */
const MAX_DEGREES = 1e10;

/** CHISQ.DIST(x, deg_freedom, cumulative): the left-tailed chi-squared distribution (deg_freedom is truncated). */
const CHISQ_DIST: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call([xValue, degreesValue, cumulativeValue]) {
    const x = toNumber(xValue);
    if (isError(x)) return x;
    const degrees = toInteger(degreesValue);
    if (isError(degrees)) return degrees;
    const cumulative = toBoolean(cumulativeValue);
    if (isError(cumulative)) return cumulative;
    if (x < 0 || degrees < 1 || degrees > MAX_DEGREES) return err.num;
    const k = degrees / 2;
    if (cumulative) return regularizedGammaP(k, x / 2);
    if (x === 0) return degrees === 2 ? 0.5 : degrees > 2 ? 0 : err.num;
    return checkNumber(Math.exp((k - 1) * Math.log(x) - x / 2 - k * Math.LN2 - gammaLn(k)));
  },
};

export default CHISQ_DIST;
