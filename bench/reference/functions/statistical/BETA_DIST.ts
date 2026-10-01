import type { FormulaFunction } from '../../core/types';
import { checkNumber, toBoolean, toNumber } from '../../core/coerce';
import { optionalNumber } from '../../core/args';
import { err, isError } from '../../core/errors';
import { gammaLn } from '../../helpers/gamma';
import { regularizedBeta } from '../../helpers/incompleteBeta';

/** BETA.DIST(x, alpha, beta, cumulative, [A], [B]): the beta distribution on [A, B] (0 and 1 by default), cumulative or the density. */
const BETA_DIST: FormulaFunction = {
  minArgs: 4,
  maxArgs: 6,
  call(args) {
    const x = toNumber(args[0]);
    if (isError(x)) return x;
    const alpha = toNumber(args[1]);
    if (isError(alpha)) return alpha;
    const beta = toNumber(args[2]);
    if (isError(beta)) return beta;
    const cumulative = toBoolean(args[3]);
    if (isError(cumulative)) return cumulative;
    const lower = optionalNumber(args, 4, 0);
    if (isError(lower)) return lower;
    const upper = optionalNumber(args, 5, 1);
    if (isError(upper)) return upper;
    if (alpha <= 0 || beta <= 0 || x < lower || x > upper || lower === upper) return err.num;
    const width = upper - lower;
    const t = (x - lower) / width;
    if (cumulative) return regularizedBeta(t, alpha, beta);
    const logDensity = (alpha - 1) * Math.log(t) + (beta - 1) * Math.log1p(-t) + gammaLn(alpha + beta) - gammaLn(alpha) - gammaLn(beta);
    return checkNumber(Math.exp(logDensity) / width);
  },
};

export default BETA_DIST;
