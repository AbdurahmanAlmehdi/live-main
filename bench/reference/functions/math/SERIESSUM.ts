import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { checkNumber, toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** SERIESSUM(x, n, m, coefficients): a1·x^n + a2·x^(n+m) + a3·x^(n+2m) + ... */
const SERIESSUM: FormulaFunction = {
  minArgs: 4,
  maxArgs: 4,
  call([xValue, nValue, mValue, coefficientsValue]) {
    const x = toNumber(xValue);
    if (isError(x)) return x;
    const n = toNumber(nValue);
    if (isError(n)) return n;
    const m = toNumber(mValue);
    if (isError(m)) return m;
    const coefficients = collectNumbers([coefficientsValue]);
    if (isError(coefficients)) return coefficients;
    let total = 0;
    coefficients.forEach((a, i) => {
      total += a * Math.pow(x, n + i * m);
    });
    return checkNumber(total);
  },
};

export default SERIESSUM;
