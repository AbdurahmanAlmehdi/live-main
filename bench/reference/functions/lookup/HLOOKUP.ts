import type { FormulaFunction } from '../../core/types';
import { cellsOf, toRange } from '../../core/range';
import { toInteger } from '../../core/coerce';
import { optionalBoolean } from '../../core/args';
import { err, isError } from '../../core/errors';
import { findExact } from '../../helpers/lookupExact';
import { findApproximate } from '../../helpers/lookupApprox';

/**
 * HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup]): finds lookup_value in the
 * first row of the table and returns the cell in the same column, in row row_index_num. range_lookup
 * TRUE (default) is an approximate match on sorted data; FALSE an exact match (wildcards allowed).
 */
const HLOOKUP: FormulaFunction = {
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
    if (offset > table.height) return err.ref;
    const lookupValue = cellsOf(needle)[0];
    const keys = Array.from({ length: table.width }, (_, c) => table.at(0, c));
    const index = approximate ? findApproximate(lookupValue, keys, 'ascending') : findExact(lookupValue, keys);
    return index < 0 ? err.na : table.at(offset - 1, index);
  },
};

export default HLOOKUP;
