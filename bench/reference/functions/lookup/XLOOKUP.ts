import type { FormulaFunction } from '../../core/types';
import type { Scalar } from '../../core/value';
import { cellsOf } from '../../core/range';
import { compareScalars } from '../../core/compare';
import { optionalInteger } from '../../core/args';
import { err, isError } from '../../core/errors';
import { findExact } from '../../helpers/lookupExact';

/** Index of the closest match below (-1) or above (1) the needle, among cells of its type. */
function findNearest(needle: Scalar, cells: readonly Scalar[], direction: -1 | 1): number {
  let best = -1;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell === null || typeof cell !== typeof needle) continue;
    const c = compareScalars(cell, needle);
    if (c === 0) return i;
    if (c !== direction) continue;
    const prev = best < 0 ? undefined : cells[best];
    if (prev === undefined || compareScalars(cell, prev as Scalar) === -direction) best = i;
  }
  return best;
}

/**
 * XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode]):
 * the return_array cell matching lookup_value. match_mode 0 exact (default; * and ? are
 * literal), -1 exact or next smaller, 1 exact or next larger, 2 wildcard; search_mode 1
 * first-to-last (default) or -1 last-to-first.
 */
const XLOOKUP: FormulaFunction = {
  minArgs: 3,
  maxArgs: 6,
  call(args) {
    const [needleValue, lookupArray, returnArray] = args;
    if (isError(needleValue)) return needleValue;
    const matchMode = optionalInteger(args, 4, 0);
    if (isError(matchMode)) return matchMode;
    const searchMode = optionalInteger(args, 5, 1);
    if (isError(searchMode)) return searchMode;
    const needle = cellsOf(needleValue)[0];
    const keys = cellsOf(lookupArray);
    const results = cellsOf(returnArray);
    if (keys.length !== results.length) return err.value;
    if (searchMode !== 1 && searchMode !== -1) return err.value;
    const ordered = searchMode === 1 ? keys : [...keys].reverse();
    let index: number;
    if (matchMode === 0) index = findExact(needle, ordered, { wildcards: false });
    else if (matchMode === 2) index = findExact(needle, ordered);
    else if (matchMode === -1 || matchMode === 1) index = findNearest(needle, ordered, matchMode);
    else return err.value;
    if (index < 0) return args.length > 3 && args[3] !== null ? args[3] : err.na;
    return results[searchMode === 1 ? index : keys.length - 1 - index];
  },
};

export default XLOOKUP;
