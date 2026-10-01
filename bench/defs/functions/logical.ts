import type { FnSpec } from '../types.ts';

const l = (name: string, signature: string, summary: string, cases: FnSpec['cases']): FnSpec => ({ name, category: 'logical', signature, summary, cases });

export const logical: FnSpec[] = [
  l('AND', 'AND(logical1, [logical2], ...)', 'Returns TRUE when every argument is TRUE. Text and empty cells inside arrays are ignored; with no logical values at all the result is #VALUE!.', [
    '=AND(TRUE, TRUE)', '=AND(TRUE, FALSE)', '=AND(1, 2)', '=AND(0, TRUE)', '=AND({TRUE, TRUE, "x"})', '=AND({TRUE, FALSE}, TRUE)',
    { f: '=AND({"a", "b"})', expect: { error: '#VALUE!' }, why: 'no logical values' }, '=AND(TRUE, #N/A)',
  ]),
  l('OR', 'OR(logical1, [logical2], ...)', 'Returns TRUE when any argument is TRUE. Text and empty cells inside arrays are ignored; with no logical values at all the result is #VALUE!.', [
    '=OR(FALSE, TRUE)', '=OR(FALSE, FALSE)', '=OR(0, 0.5)', '=OR({FALSE, "x", TRUE})', '=OR({FALSE, FALSE}, FALSE)',
    { f: '=OR({"a"})', expect: { error: '#VALUE!' }, why: 'no logical values' }, '=OR(#DIV/0!, TRUE)',
  ]),
  l('XOR', 'XOR(logical1, [logical2], ...)', 'Returns TRUE when an odd number of arguments are TRUE.', [
    '=XOR(TRUE, FALSE)', '=XOR(TRUE, TRUE)', '=XOR(TRUE, TRUE, TRUE)', '=XOR({TRUE, FALSE, TRUE}, 1)', '=XOR(0, 0)',
    { f: '=XOR({"x"})', expect: { error: '#VALUE!' }, why: 'no logical values' }, '=XOR(#N/A)',
  ]),
  l('NOT', 'NOT(logical)', 'Reverses a logical value.', ['=NOT(TRUE)', '=NOT(FALSE)', '=NOT(0)', '=NOT(5)', { f: '=NOT("x")', expect: { error: '#VALUE!' }, why: 'text that is not TRUE/FALSE' }, '=NOT(#N/A)']),
  l('IF', 'IF(logical_test, [value_if_true], [value_if_false])', 'Returns one value when the test is TRUE and another when it is FALSE. An omitted value_if_false gives FALSE; an empty value gives 0.', [
    '=IF(TRUE, 1, 2)', '=IF(FALSE, 1, 2)', '=IF(1 > 2, "yes", "no")', '=IF(0, "a", "b")', '=IF(FALSE, 1)',
    { f: '=IF(TRUE, , 2)', expect: 0, why: 'an empty value_if_true gives 0' },
    { f: '=IF("x", 1, 2)', expect: { error: '#VALUE!' }, why: 'test is text' }, '=IF(#N/A, 1, 2)', '=IF(TRUE, #DIV/0!, 1)',
  ]),
  l('IFS', 'IFS(logical_test1, value1, [logical_test2, value2], ...)', 'Returns the value of the first TRUE test; #N/A when no test is TRUE.', [
    '=IFS(FALSE, 1, TRUE, 2)', '=IFS(TRUE, "first", TRUE, "second")', '=IFS(1 > 2, "a", 2 > 1, "b")', '=IFS(0, 1, 5, 2)',
    { f: '=IFS(FALSE, 1, FALSE, 2)', expect: { error: '#N/A' }, why: 'no test is TRUE' },
    { f: '=IFS(#VALUE!, 1)', expect: { error: '#VALUE!' }, why: 'error in a test' },
  ]),
  l('IFERROR', 'IFERROR(value, value_if_error)', 'Returns value_if_error when value is an error, otherwise value.', ['=IFERROR(1/0, "oops")', '=IFERROR(5, "oops")', '=IFERROR(#N/A, 0)', '=IFERROR("x", 1)', '=IFERROR(SQRT(-1), -1)']),
  l('IFNA', 'IFNA(value, value_if_na)', 'Returns value_if_na when value is #N/A, otherwise value.', ['=IFNA(#N/A, "missing")', '=IFNA(5, "missing")', '=IFNA(1/0, "missing")', '=IFNA("x", 1)', '=IFNA(NA(), 0)']),
  l('SWITCH', 'SWITCH(expression, value1, result1, [value2, result2], ..., [default])', 'Compares expression with each value (case-insensitive for text) and returns the matching result, or the default; #N/A when nothing matches.', [
    '=SWITCH(2, 1, "one", 2, "two")', '=SWITCH(3, 1, "one", 2, "two", "other")', { f: '=SWITCH("b", "a", 1, "B", 2)', expect: 2, why: 'comparison is case-insensitive' }, '=SWITCH(TRUE, FALSE, 0, TRUE, 1)',
    { f: '=SWITCH(9, 1, "one", 2, "two")', expect: { error: '#N/A' }, why: 'no match and no default' }, { f: '=SWITCH(#DIV/0!, 1, 2)', expect: { error: '#DIV/0!' }, why: 'an error expression propagates' },
  ]),
  l('TRUE', 'TRUE()', 'Returns the logical value TRUE.', ['=TRUE()', '=TRUE()+1', '=NOT(TRUE())', '=IF(TRUE(), "y", "n")']),
  l('FALSE', 'FALSE()', 'Returns the logical value FALSE.', ['=FALSE()', '=FALSE()+1', '=NOT(FALSE())', '=IF(FALSE(), "y", "n")']),
];
