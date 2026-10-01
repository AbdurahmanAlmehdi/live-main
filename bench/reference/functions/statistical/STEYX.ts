import type { FormulaFunction } from '../../core/types';
import { err, isError } from '../../core/errors';
import { collectPairs } from '../../helpers/pairs';
import { mean } from '../../helpers/moments';

/** STEYX(known_ys, known_xs): the standard error of the predicted y values of a linear regression. */
const STEYX: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([knownYs, knownXs]) {
    const pairs = collectPairs(knownXs, knownYs);
    if (isError(pairs)) return pairs;
    const { xs, ys } = pairs;
    if (xs.length < 3) return err.div0;
    const mx = mean(xs) as number;
    const my = mean(ys) as number;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < xs.length; i++) {
      sxy += (xs[i] - mx) * (ys[i] - my);
      sxx += (xs[i] - mx) ** 2;
      syy += (ys[i] - my) ** 2;
    }
    if (sxx === 0) return err.div0;
    return Math.sqrt((syy - (sxy * sxy) / sxx) / (xs.length - 2));
  },
};

export default STEYX;
