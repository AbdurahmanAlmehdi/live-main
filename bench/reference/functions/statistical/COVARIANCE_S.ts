import type { FormulaFunction } from '../../core/types';
import { err, isError } from '../../core/errors';
import { collectPairs } from '../../helpers/pairs';
import { mean } from '../../helpers/moments';

/** COVARIANCE.S(array1, array2): the sample covariance of the numeric pairs. */
const COVARIANCE_S: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([left, right]) {
    const pairs = collectPairs(left, right);
    if (isError(pairs)) return pairs;
    const { xs, ys } = pairs;
    if (xs.length < 2) return err.div0;
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
    return sxy / (xs.length - 1);
  },
};

export default COVARIANCE_S;
