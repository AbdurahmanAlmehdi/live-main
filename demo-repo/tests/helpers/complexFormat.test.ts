import { describe, expect, it } from 'vitest';
import { formatComplex } from '../../src/helpers/complexFormat';

describe('formatComplex', () => {
  it('formats both parts with a sign between them', () => {
    expect(formatComplex({ re: 3, im: 4, suffix: 'i' })).toBe('3+4i');
    expect(formatComplex({ re: 3, im: -4, suffix: 'j' })).toBe('3-4j');
  });

  it('omits zero parts and unit coefficients', () => {
    expect(formatComplex({ re: 0, im: 4, suffix: 'i' })).toBe('4i');
    expect(formatComplex({ re: 5, im: 0, suffix: 'i' })).toBe('5');
    expect(formatComplex({ re: 0, im: 0, suffix: 'i' })).toBe('0');
    expect(formatComplex({ re: 2, im: 1, suffix: 'i' })).toBe('2+i');
    expect(formatComplex({ re: 0, im: -1, suffix: 'j' })).toBe('-j');
  });

  it('uses at most 15 significant digits', () => {
    expect(formatComplex({ re: 0.1 + 0.2, im: 1 / 3, suffix: 'i' })).toBe('0.3+0.333333333333333i');
  });
});
