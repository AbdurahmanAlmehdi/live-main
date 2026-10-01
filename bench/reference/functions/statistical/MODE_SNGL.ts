import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { err, isError } from '../../core/errors';

/** MODE.SNGL(number1, ...): the most frequent number (earliest on ties); #N/A when nothing repeats. */
const MODE_SNGL: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    const counts = new Map<number, number>();
    for (const n of numbers) counts.set(n, (counts.get(n) ?? 0) + 1);
    let best: number | undefined;
    let bestCount = 1;
    for (const n of numbers) {
      const count = counts.get(n)!;
      if (count > bestCount) {
        best = n;
        bestCount = count;
      }
    }
    return best === undefined ? err.na : best;
  },
};

export default MODE_SNGL;
