import { describe, expect, it } from 'vitest';
import { fromRoman, toRoman } from '../../src/helpers/roman';

describe('roman numerals', () => {
  it('writes classic numerals', () => {
    expect(toRoman(1999)).toBe('MCMXCIX');
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(3999)).toBe('MMMCMXCIX');
    expect(toRoman(0)).toBe('');
  });

  it('reads numerals in any case', () => {
    expect(fromRoman('MCMXCIX')).toBe(1999);
    expect(fromRoman('mmxxiv')).toBe(2024);
    expect(fromRoman('-XL')).toBe(-40);
    expect(fromRoman('')).toBe(0);
  });

  it('rejects other characters', () => {
    expect(fromRoman('XIIZ')).toMatchObject({ code: '#VALUE!' });
  });
});
