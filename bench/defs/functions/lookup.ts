import type { FnSpec } from '../types.ts';

const l = (name: string, signature: string, summary: string, cases: FnSpec['cases']): FnSpec => ({ name, category: 'lookup', signature, summary, cases });

const TABLE = '{"apple", 1.5, 10; "banana", 0.25, 20; "cherry", 3, 30; "date", 2, 40}';
const SORTED = '{10, "low"; 20, "mid"; 30, "high"; 40, "top"}';

export const lookup: FnSpec[] = [
  l('CHOOSE', 'CHOOSE(index_num, value1, [value2], ...)', 'Returns the value at position index_num (truncated) in the list of values.', ['=CHOOSE(2, "a", "b", "c")', '=CHOOSE(1, 10, 20)', { f: '=CHOOSE(2.9, "x", "y", "z")', expect: 'y', why: 'index is truncated' }, '=CHOOSE(3, 1, 2, TRUE)', '=CHOOSE(0, "a", "b")', '=CHOOSE(4, "a", "b")', { f: '=CHOOSE("x", 1)', expect: { error: '#VALUE!' }, why: 'index is not a number' }]),
  l('COLUMNS', 'COLUMNS(array)', 'Returns the number of columns in an array.', ['=COLUMNS({1, 2, 3})', '=COLUMNS({1; 2; 3})', '=COLUMNS({1, 2; 3, 4})', { f: '=COLUMNS(5)', expect: 1, why: 'a single value is one column' }]),
  l('ROWS', 'ROWS(array)', 'Returns the number of rows in an array.', ['=ROWS({1, 2, 3})', '=ROWS({1; 2; 3})', '=ROWS({1, 2; 3, 4; 5, 6})', { f: '=ROWS(5)', expect: 1, why: 'a single value is one row' }]),
  l('INDEX', 'INDEX(array, row_num, [column_num])', 'Returns the cell at a row and column of an array (a single row or column can be indexed with one number).', [
    '=INDEX({1, 2; 3, 4}, 2, 2)', '=INDEX({1, 2; 3, 4}, 1, 2)', { f: '=INDEX({"a", "b", "c"}, 2)', expect: 'b', why: 'a single row can be indexed with one number' }, '=INDEX({"a"; "b"; "c"}, 3)', '=INDEX({1, 2; 3, 4}, 3, 1)', '=INDEX({1, 2; 3, 4}, 1, 3)', '=INDEX({1, 2; 3, 4}, -1, 1)',
  ]),
  l('MATCH', 'MATCH(lookup_value, lookup_array, [match_type])', 'Returns the position of a value in a row or column: exact (0, wildcards allowed for text), largest <= value in ascending data (1, default), or smallest >= value in descending data (-1).', [
    '=MATCH(39, {25, 38, 40, 41}, 1)', '=MATCH(41, {25, 38, 40, 41}, 0)', '=MATCH(40, {41, 40, 38, 25}, -1)', '=MATCH("b*", {"apple", "banana", "cherry"}, 0)', '=MATCH("CHERRY", {"apple", "banana", "cherry"}, 0)', '=MATCH(25, {25, 38, 40, 41})', '=MATCH(10, {25, 38, 40, 41}, 1)', '=MATCH("x", {"apple", "banana"}, 0)',
  ]),
  l('VLOOKUP', 'VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])', 'Looks for a value in the first column of a table and returns the value in the same row of another column (approximate match on sorted data by default).', [
    `=VLOOKUP("cherry", ${TABLE}, 2, FALSE)`, `=VLOOKUP("BANANA", ${TABLE}, 3, FALSE)`, { f: `=VLOOKUP("d*", ${TABLE}, 2, FALSE)`, expect: 2, why: 'exact match supports wildcards' }, `=VLOOKUP(25, ${SORTED}, 2)`, `=VLOOKUP(40, ${SORTED}, 2, TRUE)`,
    `=VLOOKUP("kiwi", ${TABLE}, 2, FALSE)`, `=VLOOKUP(5, ${SORTED}, 2)`, `=VLOOKUP("apple", ${TABLE}, 4, FALSE)`,
  ]),
  l('HLOOKUP', 'HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup])', 'Looks for a value in the first row of a table and returns the value in the same column of another row (approximate match on sorted data by default).', [
    '=HLOOKUP("b", {"a", "b", "c"; 1, 2, 3}, 2, FALSE)', '=HLOOKUP("C", {"a", "b", "c"; 1, 2, 3; 4, 5, 6}, 3, FALSE)', { f: '=HLOOKUP("b?", {"a1", "b2", "c3"; 1, 2, 3}, 2, FALSE)', expect: 2, why: 'exact match supports wildcards' }, '=HLOOKUP(25, {10, 20, 30; "x", "y", "z"}, 2)',
    '=HLOOKUP("q", {"a", "b"; 1, 2}, 2, FALSE)', '=HLOOKUP(5, {10, 20; 1, 2}, 2, TRUE)', '=HLOOKUP("a", {"a", "b"; 1, 2}, 3, FALSE)',
  ]),
  l('LOOKUP', 'LOOKUP(lookup_value, lookup_vector, [result_vector])', 'Finds the largest value <= lookup_value in a sorted vector and returns the corresponding value of result_vector (or of the vector itself).', [
    '=LOOKUP(4.19, {4.14, 4.19, 5.17, 5.77, 6.39}, {"red", "orange", "yellow", "green", "blue"})', '=LOOKUP(5, {4.14, 4.19, 5.17, 5.77, 6.39}, {"red", "orange", "yellow", "green", "blue"})', '=LOOKUP(7.66, {4.14, 4.19, 5.17, 5.77, 6.39}, {"red", "orange", "yellow", "green", "blue"})',
    '=LOOKUP(0, {4.14, 4.19, 5.17}, {"red", "orange", "yellow"})', '=LOOKUP(3, {1, 2, 3, 4})', '=LOOKUP("c", {"a", "b", "d"}, {1, 2, 3})',
  ]),
  l('XLOOKUP', 'XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode])', 'Searches lookup_array for lookup_value and returns the corresponding cell of return_array. match_mode: 0 exact (default), -1 exact or next smaller, 1 exact or next larger, 2 wildcard; search_mode: 1 first-to-last (default), -1 last-to-first.', [
    { f: '=XLOOKUP("b", {"a", "b", "c"}, {1, 2, 3})', expect: 2, why: 'formula.js has no XLOOKUP; hand-checked against Excel' },
    { f: '=XLOOKUP("B", {"a", "b", "c"}, {1, 2, 3})', expect: 2, why: 'case-insensitive' },
    { f: '=XLOOKUP("z", {"a", "b", "c"}, {1, 2, 3})', expect: { error: '#N/A' }, why: 'not found' },
    { f: '=XLOOKUP("z", {"a", "b", "c"}, {1, 2, 3}, "none")', expect: 'none', why: 'if_not_found' },
    { f: '=XLOOKUP("b*", {"a", "bb", "b*"}, {1, 2, 3})', expect: 3, why: 'exact mode treats * literally' },
    { f: '=XLOOKUP("b*", {"a", "bb", "b*"}, {1, 2, 3}, "none", 2)', expect: 2, why: 'wildcard mode' },
    { f: '=XLOOKUP(25, {10, 20, 30}, {"x", "y", "z"}, "none", -1)', expect: 'y', why: 'exact or next smaller' },
    { f: '=XLOOKUP(25, {10, 20, 30}, {"x", "y", "z"}, "none", 1)', expect: 'z', why: 'exact or next larger' },
    { f: '=XLOOKUP(2, {2, 1, 2}, {"first", "mid", "last"}, , 0, -1)', expect: 'last', why: 'search from the end' },
    { f: '=XLOOKUP(1, {1, 2}, {1, 2, 3})', expect: { error: '#VALUE!' }, why: 'lookup and return arrays differ in size' },
  ]),
  l('TRANSPOSE', 'TRANSPOSE(array)', 'Swaps the rows and columns of an array.', ['=TRANSPOSE({1, 2, 3})', '=TRANSPOSE({1; 2})', '=TRANSPOSE({1, 2; 3, 4; 5, 6})', { f: '=TRANSPOSE(7)', expect: [[7]], why: 'a scalar is a 1x1 array' }, '=TRANSPOSE({"a", TRUE})']),
  l('UNIQUE', 'UNIQUE(array, [by_col], [exactly_once])', 'Returns the distinct rows (or columns) of an array, in order of first appearance; text compares case-insensitively.', [
    { f: '=UNIQUE({1; 2; 2; 3; 1})', expect: [[1], [2], [3]], why: 'hand-checked against Excel' },
    { f: '=UNIQUE({"a"; "A"; "b"})', expect: [['a'], ['b']], why: 'case-insensitive' },
    { f: '=UNIQUE({1, 1; 2, 2; 1, 1})', expect: [[1, 1], [2, 2]], why: 'whole rows compared' },
    { f: '=UNIQUE({1, 2, 1}, TRUE)', expect: [[1, 2]], why: 'by column' },
    { f: '=UNIQUE({1; 2; 2; 3}, FALSE, TRUE)', expect: [[1], [3]], why: 'exactly once' },
    { f: '=UNIQUE({1; 1}, FALSE, TRUE)', expect: { error: '#VALUE!' }, why: 'nothing occurs exactly once (empty result)' },
  ]),
  l('SORT', 'SORT(array, [sort_index], [sort_order], [by_col])', 'Sorts the rows (or columns) of an array by one of its columns (or rows); sort_order 1 ascending (default) or -1 descending. Numbers sort before text before booleans.', [
    { f: '=SORT({3; 1; 2})', expect: [[1], [2], [3]], why: 'formula.js SORT differs; hand-checked' },
    { f: '=SORT({3; 1; 2}, 1, -1)', expect: [[3], [2], [1]], why: 'descending' },
    { f: '=SORT({"b", 2; "a", 1; "c", 3}, 2)', expect: [['a', 1], ['b', 2], ['c', 3]], why: 'by the second column' },
    { f: '=SORT({"b"; "A"; "c"; 1; TRUE})', expect: [[1], ['A'], ['b'], ['c'], [true]], why: 'numbers, then text (case-insensitive), then booleans' },
    { f: '=SORT({3, 1, 2}, 1, 1, TRUE)', expect: [[1, 2, 3]], why: 'sort columns' },
    { f: '=SORT({1; 2}, 3)', expect: { error: '#VALUE!' }, why: 'sort_index out of range' },
    { f: '=SORT({1; 2}, 1, 2)', expect: { error: '#VALUE!' }, why: 'sort_order must be 1 or -1' },
  ]),
  l('CHOOSEROWS', 'CHOOSEROWS(array, row_num1, [row_num2], ...)', 'Returns the given rows of an array (negative numbers count from the end).', ['=CHOOSEROWS({1, 2; 3, 4; 5, 6}, 1, 3)', '=CHOOSEROWS({1, 2; 3, 4; 5, 6}, -1)', '=CHOOSEROWS({1; 2; 3}, 2, 2)', { f: '=CHOOSEROWS({1; 2}, 3)', expect: { error: '#VALUE!' }, why: 'row out of range' }, { f: '=CHOOSEROWS({1; 2}, 0)', expect: { error: '#VALUE!' }, why: 'row 0 is invalid' }]),
  l('CHOOSECOLS', 'CHOOSECOLS(array, col_num1, [col_num2], ...)', 'Returns the given columns of an array (negative numbers count from the end).', ['=CHOOSECOLS({1, 2, 3; 4, 5, 6}, 1, 3)', '=CHOOSECOLS({1, 2, 3; 4, 5, 6}, -1)', '=CHOOSECOLS({1, 2, 3}, 2, 2)', { f: '=CHOOSECOLS({1, 2}, 3)', expect: { error: '#VALUE!' }, why: 'column out of range' }, { f: '=CHOOSECOLS({1, 2}, 0)', expect: { error: '#VALUE!' }, why: 'column 0 is invalid' }]),
  l('TAKE', 'TAKE(array, rows, [columns])', 'Returns rows (and columns) from the start of an array, or from the end when negative.', ['=TAKE({1, 2; 3, 4; 5, 6}, 2)', '=TAKE({1, 2; 3, 4; 5, 6}, -1)', '=TAKE({1, 2, 3; 4, 5, 6}, 2, 2)', '=TAKE({1, 2, 3}, 1, -2)', '=TAKE({1, 2; 3, 4}, 5)', { f: '=TAKE({1, 2; 3, 4}, 0)', expect: { error: '#VALUE!' }, why: 'zero rows is an empty array' }]),
  l('DROP', 'DROP(array, rows, [columns])', 'Removes rows (and columns) from the start of an array, or from the end when negative.', ['=DROP({1, 2; 3, 4; 5, 6}, 1)', '=DROP({1, 2; 3, 4; 5, 6}, -2)', '=DROP({1, 2, 3; 4, 5, 6}, 0, 1)', '=DROP({1, 2, 3}, 0, -1)', { f: '=DROP({1, 2; 3, 4}, 2)', expect: { error: '#VALUE!' }, why: 'nothing left' }]),
  l('VSTACK', 'VSTACK(array1, [array2], ...)', 'Stacks arrays vertically; narrower arrays are padded with #N/A.', ['=VSTACK({1, 2}, {3, 4})', { f: '=VSTACK(1, 2, 3)', expect: [[1], [2], [3]], why: 'scalars stack as rows' }, '=VSTACK({1; 2}, {3; 4})', { f: '=VSTACK({1, 2}, 3)', expect: [[1, 2], [3, { error: '#N/A' }]], why: 'padding with #N/A' }]),
  l('HSTACK', 'HSTACK(array1, [array2], ...)', 'Stacks arrays horizontally; shorter arrays are padded with #N/A.', ['=HSTACK({1; 2}, {3; 4})', { f: '=HSTACK(1, 2, 3)', expect: [[1, 2, 3]], why: 'scalars stack as columns' }, '=HSTACK({1, 2}, {3, 4})', { f: '=HSTACK({1; 2}, 3)', expect: [[1, 3], [2, { error: '#N/A' }]], why: 'padding with #N/A' }]),
];
