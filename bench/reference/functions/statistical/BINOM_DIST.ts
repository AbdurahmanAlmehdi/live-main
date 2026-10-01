import type { FormulaFunction } from '../../core/types';
import { checkNumber, toBoolean, toInteger, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { combinations } from '../../helpers/combinatorics';

/** Probability of exactly k successes in n trials with success probability p. */
function binomialMass(k: number, n: number, p: number): number {
  return combinations(n, k) * p ** k * (1 - p) ** (n - k);
}

/** BINOM.DIST(number_s, trials, probability_s, cumulative): the binomial distribution (number_s and trials are truncated). */
const BINOM_DIST: FormulaFunction = {
  minArgs: 4,
  maxArgs: 4,
  call([successesValue, trialsValue, pValue, cumulativeValue]) {
    const successes = toInteger(successesValue);
    if (isError(successes)) return successes;
    const trials = toInteger(trialsValue);
    if (isError(trials)) return trials;
    const p = toNumber(pValue);
    if (isError(p)) return p;
    const cumulative = toBoolean(cumulativeValue);
    if (isError(cumulative)) return cumulative;
    if (successes < 0 || successes > trials || p < 0 || p > 1) return err.num;
    if (!cumulative) return checkNumber(binomialMass(successes, trials, p));
    let sum = 0;
    for (let k = 0; k <= successes; k++) sum += binomialMass(k, trials, p);
    return checkNumber(sum);
  },
};

export default BINOM_DIST;
