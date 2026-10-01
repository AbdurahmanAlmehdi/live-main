import type { FormulaFunction } from '../../core/types';
import { err, isError } from '../../core/errors';
import { collectPairs } from '../../helpers/pairs';
import { mean } from '../../helpers/moments';

/** PEARSON(array1, array2): the Pearson correlation coefficient of the numeric pairs. */
const PEARSON: FormulaFunction = {
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
    if (sxx === 0 || syy === 0) return err.div0;
    return sxy / Math.sqrt(sxx * syy);
  },
};

export default PEARSON;
