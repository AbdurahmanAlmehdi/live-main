import type { FnSpec } from '../types.ts';

const e = (name: string, signature: string, summary: string, cases: FnSpec['cases'], extra: Partial<FnSpec> = {}): FnSpec => ({
  name,
  category: 'engineering',
  signature,
  summary,
  cases,
  ...extra,
});

export const engineering: FnSpec[] = [
  // Base conversions
  e('BIN2DEC', 'BIN2DEC(number)', 'Converts a binary number (up to 10 digits, two\'s complement) to decimal.', [
    '=BIN2DEC("1100100")', '=BIN2DEC(1010)', '=BIN2DEC("1111111111")', '=BIN2DEC("1000000000")', '=BIN2DEC("0")',
    { f: '=BIN2DEC("")', expect: 0, why: 'empty text is 0' },
    '=BIN2DEC("102")',
    { f: '=BIN2DEC(TRUE)', expect: { error: '#VALUE!' }, why: 'Excel engineering functions reject booleans' },
    '=BIN2DEC("11111111111")',
    { f: '=BIN2DEC(#N/A)', expect: { error: '#N/A' }, why: 'errors propagate' },
  ]),
  e('BIN2HEX', 'BIN2HEX(number, [places])', 'Converts a binary number to hexadecimal, optionally zero-padded to places digits.', [
    { f: '=BIN2HEX("11111011", 4)', expect: '00FB', why: 'Excel returns upper-case hex digits' },
    { f: '=BIN2HEX("1110")', expect: 'E', why: 'Excel returns upper-case hex digits' },
    { f: '=BIN2HEX("1111111111")', expect: 'FFFFFFFFFF', why: 'Excel returns upper-case hex digits' },
    '=BIN2HEX(101, 3.9)', '=BIN2HEX("11111011", 1)', '=BIN2HEX("12")', '=BIN2HEX("1", -1)', '=BIN2HEX("1", "x")',
  ]),
  e('BIN2OCT', 'BIN2OCT(number, [places])', 'Converts a binary number to octal, optionally zero-padded to places digits.', [
    '=BIN2OCT("1001", 3)', '=BIN2OCT("1100100")', '=BIN2OCT("1111111111")', '=BIN2OCT(111)', '=BIN2OCT("1001", 1)', '=BIN2OCT("2")',
  ]),
  e('DEC2BIN', 'DEC2BIN(number, [places])', 'Converts a decimal integer (-512..511, truncated) to binary, two\'s complement for negatives.', [
    '=DEC2BIN(9, 4)', '=DEC2BIN(9)', '=DEC2BIN(-100)', '=DEC2BIN(511)',
    { f: '=DEC2BIN(9.7)', expect: '1001', why: 'number is truncated' },
    '=DEC2BIN("12")', '=DEC2BIN(0)', '=DEC2BIN(-1, 3)', '=DEC2BIN(512)', '=DEC2BIN(-513)', '=DEC2BIN(9, 2)', '=DEC2BIN("x")',
  ]),
  e('DEC2HEX', 'DEC2HEX(number, [places])', 'Converts a decimal integer to hexadecimal, two\'s complement (10 digits) for negatives.', [
    '=DEC2HEX(100, 4)',
    { f: '=DEC2HEX(255)', expect: 'FF', why: 'Excel returns upper-case hex digits' },
    { f: '=DEC2HEX(-54)', expect: 'FFFFFFFFCA', why: 'Excel returns upper-case hex digits' },
    { f: '=DEC2HEX(28)', expect: '1C', why: 'Excel returns upper-case hex digits' },
    { f: '=DEC2HEX(549755813887)', expect: '7FFFFFFFFF', why: 'Excel returns upper-case hex digits' },
    '=DEC2HEX(-549755813888)', '=DEC2HEX(549755813888)', '=DEC2HEX(64, 1)',
    { f: '=DEC2HEX(TRUE)', expect: { error: '#VALUE!' }, why: 'Excel engineering functions reject booleans' },
    '=DEC2HEX("x")',
  ]),
  e('DEC2OCT', 'DEC2OCT(number, [places])', 'Converts a decimal integer to octal, two\'s complement (10 digits) for negatives.', [
    '=DEC2OCT(58, 3)', '=DEC2OCT(-100)', '=DEC2OCT(8)', '=DEC2OCT(536870911)', '=DEC2OCT(536870912)', '=DEC2OCT(58, 1)', '=DEC2OCT("x")',
  ]),
  e('HEX2BIN', 'HEX2BIN(number, [places])', 'Converts a hexadecimal number to binary (result must fit in 10 binary digits).', [
    '=HEX2BIN("F", 8)', '=HEX2BIN("B7")', '=HEX2BIN("FFFFFFFE00")', '=HEX2BIN("1FF")', '=HEX2BIN("200")', '=HEX2BIN("G")', '=HEX2BIN("F", 2)',
  ]),
  e('HEX2DEC', 'HEX2DEC(number)', 'Converts a hexadecimal number (up to 10 digits, two\'s complement) to decimal.', [
    '=HEX2DEC("A5")', '=HEX2DEC("FFFFFFFF5B")', '=HEX2DEC("3DA408B9")', '=HEX2DEC("ff")', '=HEX2DEC(100)', '=HEX2DEC("8000000000")',
    '=HEX2DEC("FFFFFFFFFFF")', '=HEX2DEC("G1")',
  ]),
  e('HEX2OCT', 'HEX2OCT(number, [places])', 'Converts a hexadecimal number to octal.', [
    '=HEX2OCT("F", 3)', '=HEX2OCT("3B4E")', '=HEX2OCT("FFFFFFFF00")', '=HEX2OCT("1FFFFFFF")', '=HEX2OCT("20000000")', '=HEX2OCT("Z")',
  ]),
  e('OCT2BIN', 'OCT2BIN(number, [places])', 'Converts an octal number to binary (result must fit in 10 binary digits).', [
    '=OCT2BIN("3", 3)', '=OCT2BIN("7777777000")', '=OCT2BIN(17)', '=OCT2BIN("777")', '=OCT2BIN("1000")', '=OCT2BIN("8")',
  ]),
  e('OCT2DEC', 'OCT2DEC(number)', 'Converts an octal number (up to 10 digits, two\'s complement) to decimal.', [
    '=OCT2DEC("54")', '=OCT2DEC("7777777533")', '=OCT2DEC(777)', '=OCT2DEC("4000000000")', '=OCT2DEC("19")', '=OCT2DEC("12345670123")',
  ]),
  e('OCT2HEX', 'OCT2HEX(number, [places])', 'Converts an octal number to hexadecimal.', [
    '=OCT2HEX("100", 4)',
    { f: '=OCT2HEX("7777777533")', expect: 'FFFFFFFF5B', why: 'Excel returns upper-case hex digits' },
    { f: '=OCT2HEX(17)', expect: 'F', why: 'Excel returns upper-case hex digits' },
    { f: '=OCT2HEX("3777777777")', expect: '1FFFFFFF', why: 'Excel returns upper-case hex digits' },
    '=OCT2HEX("100", 1)', '=OCT2HEX("9")',
  ]),
  // Bitwise
  e('BITAND', 'BITAND(number1, number2)', 'Bitwise AND of two integers in 0..2^48-1.', [
    '=BITAND(13, 25)', '=BITAND(1, 5)', '=BITAND(0, 7)',
    { f: '=BITAND(281474976710655, 4294967296)', expect: 4294967296, why: 'formula.js uses 32-bit operators; operands are 48-bit' },
    '=BITAND("12", 10)', '=BITAND(1.5, 1)', '=BITAND(-1, 1)', '=BITAND(281474976710656, 1)', '=BITAND("x", 1)',
  ]),
  e('BITOR', 'BITOR(number1, number2)', 'Bitwise OR of two integers in 0..2^48-1.', [
    '=BITOR(23, 10)', '=BITOR(0, 0)',
    { f: '=BITOR(4294967296, 1)', expect: 4294967297, why: 'formula.js uses 32-bit operators; operands are 48-bit' },
    { f: '=BITOR(140737488355328, 140737488355327)', expect: 281474976710655, why: 'formula.js uses 32-bit operators; operands are 48-bit' },
    '=BITOR(2.5, 1)', '=BITOR(-2, 1)', '=BITOR("x", 1)',
  ]),
  e('BITXOR', 'BITXOR(number1, number2)', 'Bitwise XOR of two integers in 0..2^48-1.', [
    '=BITXOR(5, 3)', '=BITXOR(7, 7)',
    { f: '=BITXOR(4294967297, 1)', expect: 4294967296, why: 'formula.js uses 32-bit operators; operands are 48-bit' },
    { f: '=BITXOR(281474976710655, 1)', expect: 281474976710654, why: 'formula.js uses 32-bit operators; operands are 48-bit' },
    '=BITXOR(1, 0.5)', '=BITXOR(1, -1)', '=BITXOR("x", 1)',
  ]),
  e('BITLSHIFT', 'BITLSHIFT(number, shift_amount)', 'Shifts an integer left by shift_amount bits (right for negative amounts); the result must stay below 2^48.', [
    '=BITLSHIFT(4, 2)', '=BITLSHIFT(13, -2)',
    { f: '=BITLSHIFT(1, 47)', expect: 140737488355328, why: 'formula.js uses 32-bit operators; 2^47' },
    { f: '=BITLSHIFT(1, 48)', expect: { error: '#NUM!' }, why: 'result must be below 2^48' },
    '=BITLSHIFT(5, 0)', '=BITLSHIFT(1, 54)', '=BITLSHIFT(-1, 1)', '=BITLSHIFT("x", 1)',
  ]),
  e('BITRSHIFT', 'BITRSHIFT(number, shift_amount)', 'Shifts an integer right by shift_amount bits (left for negative amounts).', [
    '=BITRSHIFT(13, 2)', '=BITRSHIFT(4, -2)',
    { f: '=BITRSHIFT(281474976710655, 47)', expect: 1, why: 'formula.js uses 32-bit operators; operands are 48-bit' },
    '=BITRSHIFT(1, 5)',
    { f: '=BITRSHIFT(1, -48)', expect: { error: '#NUM!' }, why: 'result must be below 2^48' },
    '=BITRSHIFT(1, 54)', '=BITRSHIFT(1.5, 1)', '=BITRSHIFT("x", 1)',
  ]),
  // Comparisons
  e('DELTA', 'DELTA(number1, [number2])', 'Returns 1 when two numbers are equal (number2 defaults to 0), 0 otherwise.', [
    '=DELTA(5, 4)', '=DELTA(5, 5)', '=DELTA(0.5, 0)', '=DELTA(0)', '=DELTA("3", 3)', '=DELTA(-1.5, -1.5)', '=DELTA("x", 1)',
  ]),
  e('GESTEP', 'GESTEP(number, [step])', 'Returns 1 when number >= step (step defaults to 0), 0 otherwise.', [
    '=GESTEP(5, 4)', '=GESTEP(5, 5)', '=GESTEP(-4, -5)', '=GESTEP(-1)', '=GESTEP(0)', '=GESTEP("2", 3)', '=GESTEP("x")',
  ]),
  // Error function
  e('ERF', 'ERF(lower_limit, [upper_limit])', 'Returns the error function integrated from 0 to lower_limit, or between lower_limit and upper_limit.', [
    '=ERF(0.745)', '=ERF(1)',
    { f: '=ERF(0)', expect: 0, why: 'erf(0) is exactly 0' },
    '=ERF(-1)', '=ERF(3)',
    { f: '=ERF(1, 2)', expect: 0.15262147206923786, why: 'erf(2) - erf(1); formula.js ignores upper_limit' },
    { f: '=ERF(2, 1)', expect: -0.15262147206923786, why: 'erf(1) - erf(2); formula.js ignores upper_limit' },
    '=ERF(0.1)', '=ERF("x")',
  ]),
  e('ERFC', 'ERFC(x)', 'Returns the complementary error function 1 - ERF(x).', [
    '=ERFC(1)',
    { f: '=ERFC(0)', expect: 1, why: 'erfc(0) is exactly 1' },
    '=ERFC(-1)', '=ERFC(0.5)', '=ERFC(5)', '=ERFC("x")',
  ]),
  // Complex numbers
  e('COMPLEX', 'COMPLEX(real_num, i_num, [suffix])', 'Builds a complex number "x+yi" (or "x+yj") from real and imaginary coefficients.', [
    '=COMPLEX(3, 4)', '=COMPLEX(3, 4, "j")', '=COMPLEX(0, 1)',
    { f: '=COMPLEX(0, -1)', expect: '-i', why: 'a unit imaginary part is written without the 1' },
    '=COMPLEX(2, 0)',
    { f: '=COMPLEX(0, 0)', expect: '0', why: 'the result is text' },
    '=COMPLEX(1.5, -2.25)', '=COMPLEX(3, 4, "I")', '=COMPLEX(3, 4, "k")', '=COMPLEX("x", 1)',
  ]),
  e('IMREAL', 'IMREAL(inumber)', 'Returns the real coefficient of a complex number.', [
    '=IMREAL("6-9i")', '=IMREAL("-2.5+i")', '=IMREAL("4j")',
    { f: '=IMREAL(7)', expect: 7, why: 'the result is a number' },
    '=IMREAL("1e2-3i")', '=IMREAL("abc")',
    { f: '=IMREAL(TRUE)', expect: { error: '#VALUE!' }, why: 'booleans are not complex numbers' },
  ]),
  e('IMAGINARY', 'IMAGINARY(inumber)', 'Returns the imaginary coefficient of a complex number.', [
    '=IMAGINARY("3+4i")', '=IMAGINARY("0-j")', '=IMAGINARY("4")',
    { f: '=IMAGINARY("-i")', expect: -1, why: 'the result is a number' },
    '=IMAGINARY("2.5-1.5j")', '=IMAGINARY("3+4k")',
  ]),
  e('IMABS', 'IMABS(inumber)', 'Returns the modulus of a complex number.', [
    '=IMABS("5+12i")', '=IMABS("3-4j")', '=IMABS("-2")', '=IMABS("i")', '=IMABS("1+i")',
    { f: '=IMABS("x+i")', expect: { error: '#NUM!' }, why: 'malformed complex text is #NUM!' },
  ]),
  e('IMARGUMENT', 'IMARGUMENT(inumber)', 'Returns the argument (angle in radians, in (-pi, pi]) of a complex number.', [
    '=IMARGUMENT("3+4i")',
    { f: '=IMARGUMENT("-1")', expect: 3.141592653589793, why: 'the argument is in (-pi, pi]' },
    '=IMARGUMENT("-i")', '=IMARGUMENT("-1-i")', '=IMARGUMENT("2j")', '=IMARGUMENT("0")',
    { f: '=IMARGUMENT("abc")', expect: { error: '#NUM!' }, why: 'malformed complex text is #NUM!' },
  ]),
  e('IMCONJUGATE', 'IMCONJUGATE(inumber)', 'Returns the complex conjugate of a complex number.', [
    '=IMCONJUGATE("3+4i")', '=IMCONJUGATE("1-j")', '=IMCONJUGATE("-2i")', '=IMCONJUGATE("5")',
    { f: '=IMCONJUGATE("i")', expect: '-i', why: 'a unit imaginary part is written without the 1' },
    { f: '=IMCONJUGATE("3+4")', expect: { error: '#NUM!' }, why: 'malformed complex text is #NUM!' },
  ]),
  e('IMSUM', 'IMSUM(inumber1, [inumber2], ...)', 'Returns the sum of complex numbers.', [
    '=IMSUM("3+4i", "5-3i")', '=IMSUM("1+j", "2-j")', '=IMSUM("i", "i", "i")', '=IMSUM(1, "2.5+0.5i")', '=IMSUM({"1+i", "2+2i"}, "3")',
    { f: '=IMSUM("1+i", "1+j")', expect: { error: '#VALUE!' }, why: 'mixed i and j suffixes' },
    { f: '=IMSUM("1+x")', expect: { error: '#NUM!' }, why: 'malformed complex text is #NUM!' },
  ]),
  e('IMSUB', 'IMSUB(inumber1, inumber2)', 'Returns the difference of two complex numbers.', [
    '=IMSUB("13+4i", "5+3i")',
    { f: '=IMSUB("1+j", "1+j")', expect: '0', why: 'the result is text' },
    { f: '=IMSUB("2", "i")', expect: '2-i', why: 'a unit imaginary part is written without the 1' },
    '=IMSUB("1.5-2i", "-0.5+i")',
    { f: '=IMSUB("1+i", "1+j")', expect: { error: '#VALUE!' }, why: 'mixed i and j suffixes' },
    { f: '=IMSUB("abc", "1")', expect: { error: '#NUM!' }, why: 'malformed complex text is #NUM!' },
  ]),
  e('IMPRODUCT', 'IMPRODUCT(inumber1, [inumber2], ...)', 'Returns the product of complex numbers.', [
    '=IMPRODUCT("3+4i", "5-3i")', '=IMPRODUCT("i", "i")',
    { f: '=IMPRODUCT("1+2j", 3)', expect: '3+6j', why: 'the j suffix is kept' },
    '=IMPRODUCT("1+i", "1-i", "2")',
    { f: '=IMPRODUCT({"1+i", "1+i"})', expect: '2i', why: 'arrays are multiplied element by element into one product' },
    { f: '=IMPRODUCT("1+i", "1+j")', expect: { error: '#VALUE!' }, why: 'mixed i and j suffixes' },
    { f: '=IMPRODUCT("x")', expect: { error: '#NUM!' }, why: 'malformed complex text is #NUM!' },
  ]),
  e('IMDIV', 'IMDIV(inumber1, inumber2)', 'Returns the quotient of two complex numbers.', [
    '=IMDIV("-238+240i", "10+24i")',
    { f: '=IMDIV("1", "i")', expect: '-i', why: 'a unit imaginary part is written without the 1' },
    '=IMDIV("4+2j", "2")', '=IMDIV("1+i", "1-i")', '=IMDIV("1+i", "0")',
    { f: '=IMDIV("1+i", "1+j")', expect: { error: '#VALUE!' }, why: 'mixed i and j suffixes' },
    { f: '=IMDIV("abc", "1")', expect: { error: '#NUM!' }, why: 'malformed complex text is #NUM!' },
  ]),
  e('IMSQRT', 'IMSQRT(inumber)', 'Returns the principal square root of a complex number.', [
    { f: '=IMSQRT("1+i")', expect: '1.09868411346781+0.455089860562227i', why: 'components have at most 15 significant digits' },
    '=IMSQRT("3+4i")', '=IMSQRT("4")',
    { f: '=IMSQRT("-4")', expect: '1.22464679914735E-16+2i', why: 'Excel computes the root in polar form; the angle of -4 is +pi' },
    { f: '=IMSQRT("2j")', expect: '1+j', why: 'components have at most 15 significant digits' },
    { f: '=IMSQRT("0")', expect: '0', why: 'the square root of 0 is 0' },
    { f: '=IMSQRT("abc")', expect: { error: '#NUM!' }, why: 'malformed complex text is #NUM!' },
  ]),
];
