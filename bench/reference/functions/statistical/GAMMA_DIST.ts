import type { FormulaFunction } from '../../core/types';
import { checkNumber, toBoolean, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { gammaLn } from '../../helpers/gamma';
import { regularizedGammaP } from '../../helpers/incompleteGamma';

/** GAMMA.DIST(x, alpha, beta, cumulative): the gamma distribution with shape alpha and scale beta (cumulative, or the density). */
const GAMMA_DIST: FormulaFunction = {
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
    if (cumulative) return regularizedGammaP(alpha, x / beta);
    if (x === 0) return alpha === 1 ? 1 / beta : alpha > 1 ? 0 : err.num;
    return checkNumber(Math.exp((alpha - 1) * Math.log(x) - x / beta - alpha * Math.log(beta) - gammaLn(alpha)));
  },
};

export default GAMMA_DIST;
