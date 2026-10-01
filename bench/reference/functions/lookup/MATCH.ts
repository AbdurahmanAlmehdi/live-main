import type { FormulaFunction } from '../../core/types';
import { cellsOf, isVector } from '../../core/range';
import { optionalInteger } from '../../core/args';
import { err, isError } from '../../core/errors';
import { findExact } from '../../helpers/lookupExact';
import { findApproximate } from '../../helpers/lookupApprox';

/**
 * MATCH(lookup_value, lookup_array, [match_type]): the 1-based position of a value in a row
 * or column. match_type 0: exact (wildcards allowed); 1 (default): largest value <= lookup
 * in ascending data; -1: smallest value >= lookup in descending data.
 */
const MATCH: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    const [needle, array] = args;
    if (isError(needle)) return needle;
    if (isError(array)) return array;
    const matchType = optionalInteger(args, 2, 1);
    if (isError(matchType)) return matchType;
    if (!isVector(array)) return err.na;
    const lookupValue = cellsOf(needle)[0];
    const cells = cellsOf(array);
    let index: number;
    if (matchType === 0) index = findExact(lookupValue, cells);
    else index = findApproximate(lookupValue, cells, matchType > 0 ? 'ascending' : 'descending');
    return index < 0 ? err.na : index + 1;
  },
};

export default MATCH;
