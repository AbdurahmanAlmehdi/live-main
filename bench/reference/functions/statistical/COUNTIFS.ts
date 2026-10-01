import type { FormulaFunction } from '../../core/types';
import { err, isError } from '../../core/errors';
import { matchingIndices, type CriteriaPair } from '../../helpers/criteriaRanges';

/** COUNTIFS(criteria_range1, criteria1, ...): how many positions meet every criterion. */
const COUNTIFS: FormulaFunction = {
  minArgs: 2,
  maxArgs: Infinity,
  call(args) {
    if (args.length % 2 !== 0) return err.value;
    const pairs: CriteriaPair[] = [];
    for (let i = 0; i < args.length; i += 2) pairs.push({ range: args[i], criterion: args[i + 1] });
    const indices = matchingIndices(pairs);
    if (isError(indices)) return indices;
    return indices.length;
  },
};

export default COUNTIFS;
