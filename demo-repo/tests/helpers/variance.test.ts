import { describe, expect, it } from 'vitest';
import { variance } from '../../src/helpers/variance';

describe('variance', () => {
  it('uses the n - 1 denominator', () => {
    expect(variance([1, 2, 3, 4])).toBeCloseTo(1.6666666666666667, 12);
    expect(variance([2, 4])).toBe(2);
    expect(variance([5, 5, 5])).toBe(0);
  });

  it('needs at least two values', () => {
    expect(variance([1])).toMatchObject({ code: '#DIV/0!' });
    expect(variance([])).toMatchObject({ code: '#DIV/0!' });
  });
});
