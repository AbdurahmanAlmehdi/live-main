import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { collectPairs } from '../../helpers/pairs';
import { mean } from '../../helpers/moments';

/** FORECAST(x, known_ys, known_xs): the y predicted for x by the least-squares line through the known pairs. */
const FORECAST: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call([xValue, knownYs, knownXs]) {
    const x = toNumber(xValue);
    if (isError(x)) return x;
    const pairs = collectPairs(knownXs, knownYs);
    if (isError(pairs)) return pairs;
    const { xs, ys } = pairs;
    if (xs.length < 1) return err.div0;
    const mx = mean(xs) as number;
    const my = mean(ys) as number;
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < xs.length; i++) {
      sxy += (xs[i] - mx) * (ys[i] - my);
      sxx += (xs[i] - mx) ** 2;
    }
    if (sxx === 0) return err.div0;
    return my + (sxy / sxx) * (x - mx);
  },
};

export default FORECAST;
