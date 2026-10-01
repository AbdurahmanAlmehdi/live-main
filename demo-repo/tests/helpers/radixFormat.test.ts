import { describe, expect, it } from 'vitest';
import { formatRadix } from '../../src/helpers/radixFormat';

describe('formatRadix', () => {
  it('formats non-negative numbers in upper case', () => {
    expect(formatRadix(10, 2)).toBe('1010');
    expect(formatRadix(255, 16)).toBe('FF');
    expect(formatRadix(0, 8)).toBe('0');
  });

  it('pads to places', () => {
    expect(formatRadix(5, 2, 8)).toBe('00000101');
    expect(formatRadix(255, 16, 4)).toBe('00FF');
  });

  it('writes negatives as 10-digit two\'s complement, ignoring places', () => {
    expect(formatRadix(-1, 2)).toBe('1111111111');
    expect(formatRadix(-1, 16, 3)).toBe('FFFFFFFFFF');
    expect(formatRadix(-512, 8)).toBe('7777777000');
  });

  it('rejects values that do not fit and bad places', () => {
    expect(formatRadix(512, 2)).toMatchObject({ code: '#NUM!' });
    expect(formatRadix(-513, 2)).toMatchObject({ code: '#NUM!' });
    expect(formatRadix(9, 2, 2)).toMatchObject({ code: '#NUM!' });
    expect(formatRadix(9, 2, 0)).toMatchObject({ code: '#NUM!' });
  });
});
