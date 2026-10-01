import type { FormulaFunction } from '../../core/types';
import { cellsOf, toRange } from '../../core/range';
import { toInteger } from '../../core/coerce';
import { optionalBoolean } from '../../core/args';
import { err, isError } from '../../core/errors';
import { findExact } from '../../helpers/lookupExact';
import { findApproximate } from '../../helpers/lookupApprox';

/**
 * VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup]): finds lookup_value in the
 * first column of the table and returns the cell in the same row, in column col_index_num. range_lookup
 * TRUE (default) is an approximate match on sorted data; FALSE an exact match (wildcards allowed).
 */
const VLOOKUP: FormulaFunction = {
  minArgs: 3,
  maxArgs: 4,
  call(args) {
    const [needle, tableValue] = args;
    if (isError(needle)) return needle;
    if (isError(tableValue)) return tableValue;
    const offset = toInteger(args[2]);
    if (isError(offset)) return offset;
    const approximate = optionalBoolean(args, 3, true);
    if (isError(approximate)) return approximate;
    const table = toRange(tableValue);
    if (offset < 1) return err.value;
    if (offset > table.width) return err.ref;
    const lookupValue = cellsOf(needle)[0];
    const keys = Array.from({ length: table.height }, (_, r) => table.at(r, 0));
    const index = approximate ? findApproximate(lookupValue, keys, 'ascending') : findExact(lookupValue, keys);
    return index < 0 ? err.na : table.at(index, offset - 1);
  },
};

export default VLOOKUP;
