import type { FnSpec } from '../types.ts';

const i = (name: string, signature: string, summary: string, cases: FnSpec['cases']): FnSpec => ({ name, category: 'information', signature, summary, cases });

export const information: FnSpec[] = [
  i('ISBLANK', 'ISBLANK(value)', 'Returns TRUE when the value is empty.', ['=ISBLANK(1)', '=ISBLANK("")', '=ISBLANK(FALSE)', '=ISBLANK(#N/A)', { f: '=ISBLANK(,)', expect: { error: '#N/A' }, why: 'too many arguments' }]),
  i('ISERR', 'ISERR(value)', 'Returns TRUE when the value is any error except #N/A.', ['=ISERR(1/0)', '=ISERR(#N/A)', '=ISERR(#VALUE!)', '=ISERR(1)', '=ISERR("x")']),
  i('ISERROR', 'ISERROR(value)', 'Returns TRUE when the value is any error.', ['=ISERROR(1/0)', '=ISERROR(#N/A)', '=ISERROR(#REF!)', '=ISERROR(1)', '=ISERROR("#N/A")']),
  i('ISEVEN', 'ISEVEN(number)', 'Returns TRUE when the number (truncated) is even.', ['=ISEVEN(2)', '=ISEVEN(3)', '=ISEVEN(-1)', '=ISEVEN(2.5)', '=ISEVEN(0)', { f: '=ISEVEN("x")', expect: { error: '#VALUE!' }, why: 'not a number' }]),
  i('ISODD', 'ISODD(number)', 'Returns TRUE when the number (truncated) is odd.', ['=ISODD(3)', '=ISODD(2)', '=ISODD(-1)', '=ISODD(5.9)', '=ISODD(0)', { f: '=ISODD("x")', expect: { error: '#VALUE!' }, why: 'not a number' }]),
  i('ISLOGICAL', 'ISLOGICAL(value)', 'Returns TRUE when the value is a logical value.', ['=ISLOGICAL(TRUE)', '=ISLOGICAL(1)', '=ISLOGICAL("TRUE")', '=ISLOGICAL(#N/A)']),
  i('ISNA', 'ISNA(value)', 'Returns TRUE when the value is #N/A.', ['=ISNA(#N/A)', '=ISNA(NA())', '=ISNA(1/0)', '=ISNA(1)']),
  i('ISNONTEXT', 'ISNONTEXT(value)', 'Returns TRUE when the value is not text.', ['=ISNONTEXT(1)', '=ISNONTEXT("x")', '=ISNONTEXT("")', '=ISNONTEXT(#N/A)', '=ISNONTEXT(TRUE)']),
  i('ISNUMBER', 'ISNUMBER(value)', 'Returns TRUE when the value is a number.', ['=ISNUMBER(1)', '=ISNUMBER("1")', '=ISNUMBER(TRUE)', '=ISNUMBER(#N/A)', '=ISNUMBER(-0.5)']),
  i('ISTEXT', 'ISTEXT(value)', 'Returns TRUE when the value is text.', ['=ISTEXT("x")', '=ISTEXT("")', '=ISTEXT(1)', '=ISTEXT(#N/A)', '=ISTEXT(TRUE)']),
  i('N', 'N(value)', 'Converts a value to a number: numbers stay, TRUE is 1, text is 0, errors pass through.', ['=N(7)', '=N(TRUE)', '=N(FALSE)', '=N("7")', '=N("x")', '=N(#N/A)', { f: '=N({4, 5})', expect: 4, why: 'an array gives its first cell' }]),
  i('NA', 'NA()', 'Returns the #N/A error.', ['=NA()', '=NA() + 1', '=NA() * 0', '=ISERROR(NA())']),
  i('TYPE', 'TYPE(value)', 'Returns the type of a value: 1 number, 2 text, 4 logical, 16 error, 64 array.', ['=TYPE(1)', '=TYPE("x")', '=TYPE(TRUE)', '=TYPE(#N/A)', '=TYPE({1, 2})']),
  i('ERROR.TYPE', 'ERROR.TYPE(error_val)', 'Returns a number for an error value (1 #NULL!, 2 #DIV/0!, 3 #VALUE!, 4 #REF!, 5 #NAME?, 6 #NUM!, 7 #N/A); #N/A for non-errors.', [
    '=ERROR.TYPE(#NULL!)', '=ERROR.TYPE(1/0)', '=ERROR.TYPE(#VALUE!)', '=ERROR.TYPE(#REF!)', '=ERROR.TYPE(#NAME?)', '=ERROR.TYPE(#NUM!)', '=ERROR.TYPE(#N/A)', '=ERROR.TYPE(1)',
  ]),
];
