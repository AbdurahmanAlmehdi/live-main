import type { FormulaFunction } from '../../core/types';
import { cellsOf } from '../../core/range';
import { err, isError } from '../../core/errors';
import { findApproximate } from '../../helpers/lookupApprox';

/**
 * LOOKUP(lookup_value, lookup_vector, [result_vector]): the largest value <= lookup_value in a
 * sorted vector, or the corresponding value of result_vector.
 */
const LOOKUP: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    const [needle, vector] = args;
    if (isError(needle)) return needle;
    if (isError(vector)) return vector;
    const lookupValue = cellsOf(needle)[0];
    const keys = cellsOf(vector);
    const index = findApproximate(lookupValue, keys, 'ascending');
    if (index < 0) return err.na;
    if (args.length < 3) return keys[index];
    const results = cellsOf(args[2]);
    return index < results.length ? results[index] : err.na;
  },
};

export default LOOKUP;
