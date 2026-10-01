import type { FnSpec } from '../types.ts';

const t = (name: string, signature: string, summary: string, cases: FnSpec['cases']): FnSpec => ({ name, category: 'text', signature, summary, cases });

export const text: FnSpec[] = [
  t('CHAR', 'CHAR(number)', 'Returns the character for a code 1..255 (truncated).', ['=CHAR(65)', '=CHAR(97)', '=CHAR(33)', '=CHAR(65.9)', '=CHAR(0)', { f: '=CHAR(256)', expect: { error: '#VALUE!' }, why: 'codes above 255 are invalid' }, '=CHAR("x")']),
  t('CLEAN', 'CLEAN(text)', 'Removes the non-printable characters (codes 0-31) from text.', ['=CLEAN("a"&CHAR(9)&"b")', '=CLEAN("plain")', '=CLEAN(CHAR(7)&"x"&CHAR(10))', { f: '=CLEAN(123)', expect: '123', why: 'numbers are converted to text' }, '=CLEAN(#N/A)']),
  t('CODE', 'CODE(text)', 'Returns the code of the first character of text.', ['=CODE("A")', '=CODE("alpha")', '=CODE("!")', { f: '=CODE(1)', expect: 49, why: 'numbers are converted to text' }, { f: '=CODE("")', expect: { error: '#VALUE!' }, why: 'empty text' }]),
  t('CONCAT', 'CONCAT(text1, [text2], ...)', 'Joins texts; array arguments are joined cell by cell.', ['=CONCAT("a", "b", "c")', '=CONCAT({"x", "y"; "z", "w"})', '=CONCAT(1, TRUE, "!")', '=CONCAT("a", 1.5)', '=CONCAT("", "")', '=CONCAT("a", #N/A)']),
  t('CONCATENATE', 'CONCATENATE(text1, [text2], ...)', 'Joins texts.', ['=CONCATENATE("Stream ", "population")', '=CONCATENATE(1, 2, 3)', '=CONCATENATE("a", TRUE)', '=CONCATENATE("x")', '=CONCATENATE("a", 1/0)']),
  t('DOLLAR', 'DOLLAR(number, [decimals])', 'Formats a number as currency text with decimals (2 by default); negative amounts are shown in parentheses.', [
    '=DOLLAR(1234.567)', '=DOLLAR(1234.567, -2)', '=DOLLAR(0.123, 4)', '=DOLLAR(99.888, 1)',
    { f: '=DOLLAR(-1234.567, 2)', expect: '($1,234.57)', why: 'Excel shows negative currency in parentheses' }, '=DOLLAR("x")',
  ]),
  t('EXACT', 'EXACT(text1, text2)', 'Returns TRUE when two texts are exactly equal (case-sensitive).', ['=EXACT("word", "word")', '=EXACT("Word", "word")', '=EXACT("w ord", "word")', '=EXACT(1, "1")', '=EXACT(#N/A, "x")']),
  t('FIND', 'FIND(find_text, within_text, [start_num])', 'Returns the position of find_text in within_text (case-sensitive, from start_num).', [
    '=FIND("M", "Miriam McGovern")', '=FIND("m", "Miriam McGovern")', '=FIND("M", "Miriam McGovern", 3)', '=FIND("", "abc")', '=FIND("z", "abc")', { f: '=FIND("a", "abc", 0)', expect: { error: '#VALUE!' }, why: 'start_num must be >= 1' }, '=FIND("a", "abc", 9)',
  ]),
  t('FIXED', 'FIXED(number, [decimals], [no_commas])', 'Formats a number as text with decimals (2 by default), with or without thousands separators.', ['=FIXED(1234.567, 1)', '=FIXED(1234.567, -1)', '=FIXED(-1234.567, -1, TRUE)', '=FIXED(44.332)', '=FIXED(1234567.891, 0)', '=FIXED("x")']),
  t('LEFT', 'LEFT(text, [num_chars])', 'Returns the first num_chars characters (1 by default).', ['=LEFT("Sale Price", 4)', '=LEFT("Sweden")', '=LEFT("abc", 10)', '=LEFT("abc", 0)', '=LEFT(12345, 2)', '=LEFT("abc", 1.9)', { f: '=LEFT("abc", -1)', expect: { error: '#VALUE!' }, why: 'num_chars must be >= 0' }]),
  t('RIGHT', 'RIGHT(text, [num_chars])', 'Returns the last num_chars characters (1 by default).', ['=RIGHT("Sale Price", 5)', '=RIGHT("Stock Number")', '=RIGHT("abc", 10)', '=RIGHT("abc", 0)', '=RIGHT(12345, 2)', { f: '=RIGHT("abc", -1)', expect: { error: '#VALUE!' }, why: 'num_chars must be >= 0' }]),
  t('MID', 'MID(text, start_num, num_chars)', 'Returns num_chars characters starting at start_num.', ['=MID("Fluid Flow", 1, 5)', '=MID("Fluid Flow", 7, 20)', '=MID("Fluid Flow", 20, 5)', { f: '=MID("abc", 2, 0)', expect: '', why: 'zero characters is empty text' }, '=MID(12345, 2, 3)', '=MID("abc", 0, 1)', '=MID("abc", 1, -1)']),
  t('LEN', 'LEN(text)', 'Returns the number of characters in text.', ['=LEN("Phoenix, AZ")', '=LEN("")', '=LEN("  One   ")', '=LEN(12.5)', '=LEN(TRUE)', '=LEN(#N/A)']),
  t('LOWER', 'LOWER(text)', 'Converts text to lower case.', ['=LOWER("E. E. Cummings")', '=LOWER("Apt. 2B")', '=LOWER(123)', '=LOWER(TRUE)', '=LOWER(#N/A)']),
  t('UPPER', 'UPPER(text)', 'Converts text to upper case.', ['=UPPER("total")', '=UPPER("Yield 1a")', '=UPPER(123)', '=UPPER("")', '=UPPER(#N/A)']),
  t('PROPER', 'PROPER(text)', 'Capitalizes the first letter of each word and lower-cases the rest.', ['=PROPER("this is a TITLE")', { f: '=PROPER("2-way street")', expect: '2-Way Street', why: 'any non-letter starts a new word' }, { f: '=PROPER("76BudGet")', expect: '76Budget', why: 'any non-letter starts a new word' }, { f: '=PROPER("o\'neil")', expect: 'O\'Neil', why: 'any non-letter starts a new word' }, '=PROPER(#N/A)']),
  t('REPLACE', 'REPLACE(old_text, start_num, num_chars, new_text)', 'Replaces num_chars characters starting at start_num with new_text.', [
    '=REPLACE("abcdefghijk", 6, 5, "*")', '=REPLACE("2009", 3, 2, "10")', '=REPLACE("123456", 1, 3, "@")', '=REPLACE("abc", 10, 1, "Z")', { f: '=REPLACE("abc", 0, 1, "Z")', expect: { error: '#VALUE!' }, why: 'start_num must be >= 1' }, { f: '=REPLACE("abc", 1, -1, "Z")', expect: { error: '#VALUE!' }, why: 'num_chars must be >= 0' },
  ]),
  t('REPT', 'REPT(text, number_times)', 'Repeats text number_times times (truncated).', ['=REPT("*-", 3)', '=REPT("-", 10)', '=REPT("ab", 0)', { f: '=REPT("ab", 2.9)', expect: 'abab', why: 'number_times is truncated' }, '=REPT(1, 3)', { f: '=REPT("x", -1)', expect: { error: '#VALUE!' }, why: 'number_times must be >= 0' }]),
  t('SUBSTITUTE', 'SUBSTITUTE(text, old_text, new_text, [instance_num])', 'Replaces old_text with new_text (every occurrence, or only the given instance).', [
    '=SUBSTITUTE("Sales Data", "Sales", "Cost")', '=SUBSTITUTE("Quarter 1, 2008", "1", "2", 1)', '=SUBSTITUTE("Quarter 1, 2011", "1", "2", 3)', '=SUBSTITUTE("aaa", "a", "b")', '=SUBSTITUTE("abc", "", "x")', '=SUBSTITUTE("abc", "b", "x", 5)', '=SUBSTITUTE("abc", "b", "x", 0)',
  ]),
  t('T', 'T(value)', 'Returns the value when it is text, otherwise empty text.', ['=T("Rainfall")', '=T(19)', '=T(TRUE)', '=T("")', '=T(#N/A)']),
  t('TEXT', 'TEXT(value, format_text)', 'Formats a number (or date/time serial) with a number format code.', [
    { f: '=TEXT(1234.567, "$#,##0.00")', expect: '$1,234.57', why: 'hand-checked against Excel' },
    { f: '=TEXT(0.285, "0.0%")', expect: '28.5%', why: 'hand-checked against Excel' },
    { f: '=TEXT(43845, "yyyy-mm-dd")', expect: '2020-01-15', why: 'formula.js does not support date codes' },
    { f: '=TEXT(43845, "dddd, mmmm d")', expect: 'Wednesday, January 15', why: 'formula.js does not support date codes' },
    { f: '=TEXT(0.75, "h:mm AM/PM")', expect: '6:00 PM', why: 'formula.js does not support time codes' },
    { f: '=TEXT(-5, "0.00;(0.00)")', expect: '(5.00)', why: 'formula.js does not support sections' },
    { f: '=TEXT(12345.678, "0.00E+00")', expect: '1.23E+04', why: 'formula.js does not support scientific codes' },
    { f: '=TEXT(7, "000")', expect: '007', why: 'formula.js drops leading zeros' },
    { f: '=TEXT("abc", "0.00")', expect: 'abc', why: 'non-numeric text is returned unchanged' },
    { f: '=TEXT(1234.5, "General")', expect: '1234.5', why: 'general format' },
  ]),
  t('TEXTJOIN', 'TEXTJOIN(delimiter, ignore_empty, text1, [text2], ...)', 'Joins texts (and array cells) with a delimiter, optionally skipping empty texts.', [
    '=TEXTJOIN(", ", TRUE, "a", "b", "c")', '=TEXTJOIN("-", TRUE, {"a", "", "b"})', '=TEXTJOIN("-", FALSE, {"a", "", "b"})', '=TEXTJOIN("", TRUE, 1, 2, 3)', { f: '=TEXTJOIN(" ", TRUE, "x", TRUE)', expect: 'x TRUE', why: 'booleans are written TRUE/FALSE' }, { f: '=TEXTJOIN(",", TRUE, "a", #N/A)', expect: { error: '#N/A' }, why: 'errors propagate' },
  ]),
  t('TRIM', 'TRIM(text)', 'Removes leading and trailing spaces and collapses runs of spaces to one.', ['=TRIM(" First Quarter   Earnings ")', '=TRIM("a  b")', '=TRIM("   ")', '=TRIM(12)', '=TRIM(#N/A)']),
  t('UNICHAR', 'UNICHAR(number)', 'Returns the character for a Unicode code point.', ['=UNICHAR(66)', '=UNICHAR(32)', '=UNICHAR(8364)', { f: '=UNICHAR(128512)', expect: '\u{1F600}', why: 'code points above U+FFFF are surrogate pairs' }, { f: '=UNICHAR(0)', expect: { error: '#VALUE!' }, why: 'code point 0 is invalid' }, '=UNICHAR("x")']),
  t('UNICODE', 'UNICODE(text)', 'Returns the Unicode code point of the first character of text.', ['=UNICODE("B")', '=UNICODE(" ")', '=UNICODE("€uro")', { f: '=UNICODE(UNICHAR(128512))', expect: 128512, why: 'the whole code point, not the first surrogate' }, { f: '=UNICODE("")', expect: { error: '#VALUE!' }, why: 'empty text' }]),
  t('VALUE', 'VALUE(text)', 'Converts text that looks like a number (or a date or time) to a number.', [
    '=VALUE("$1,000")', { f: '=VALUE("16:48:00")', expect: 0.7, why: 'times convert to fractions of a day' }, '=VALUE("12.5%")', '=VALUE(" 42 ")', '=VALUE(7)',
    { f: '=VALUE("2020-01-15")', expect: 43845, why: 'dates convert to their serial number' },
    { f: '=VALUE("abc")', expect: { error: '#VALUE!' }, why: 'not a number' },
  ]),
  t('NUMBERVALUE', 'NUMBERVALUE(text, [decimal_separator], [group_separator])', 'Converts text to a number using the given decimal and group separators (spaces are ignored).', [
    '=NUMBERVALUE("2.500,27", ",", ".")', { f: '=NUMBERVALUE("3.5%")', expect: 0.035, why: 'trailing percent divides by 100' }, { f: '=NUMBERVALUE("1 234.5")', expect: 1234.5, why: 'spaces are ignored' }, '=NUMBERVALUE("1,234.5")', '=NUMBERVALUE("")',
    { f: '=NUMBERVALUE("1.2.3")', expect: { error: '#VALUE!' }, why: 'two decimal separators' },
  ]),
  t('SEARCH', 'SEARCH(find_text, within_text, [start_num])', 'Returns the position of find_text in within_text (case-insensitive, wildcards * ? ~ allowed).', [
    '=SEARCH("e", "Statements", 6)', '=SEARCH("MARGIN", "Profit Margin")', { f: '=SEARCH("m?r", "Profit Margin")', expect: 8, why: '? matches one character' }, { f: '=SEARCH("p*t", "Profit Margin")', expect: 1, why: '* matches any run of characters' }, { f: '=SEARCH("~?", "Why?")', expect: 4, why: '~ escapes a wildcard' }, '=SEARCH("z", "abc")', { f: '=SEARCH("a", "abc", 0)', expect: { error: '#VALUE!' }, why: 'start_num must be >= 1' },
  ]),
];
