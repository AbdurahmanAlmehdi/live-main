import { describe, expect, it } from 'vitest';
import { parseRadix } from '../../src/helpers/radixParse';

describe('parseRadix', () => {
  it('parses positive numbers in bases 2, 8 and 16', () => {
    expect(parseRadix('1010', 2)).toBe(10);
    expect(parseRadix('777', 8)).toBe(511);
    expect(parseRadix('ff', 16)).toBe(255);
    expect(parseRadix('', 16)).toBe(0);
  });

  it('reads 10-digit two\'s complement as negative', () => {
    expect(parseRadix('1111111111', 2)).toBe(-1);
    expect(parseRadix('FFFFFFFFFF', 16)).toBe(-1);
    expect(parseRadix('7777777000', 8)).toBe(-512);
    expect(parseRadix('7FFFFFFFFF', 16)).toBe(549755813887);
  });

  it('rejects invalid digits and long inputs', () => {
    expect(parseRadix('102', 2)).toMatchObject({ code: '#NUM!' });
    expect(parseRadix('G1', 16)).toMatchObject({ code: '#NUM!' });
    expect(parseRadix('10000000000', 2)).toMatchObject({ code: '#NUM!' });
  });
});
