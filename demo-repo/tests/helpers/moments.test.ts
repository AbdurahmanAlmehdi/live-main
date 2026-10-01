import { describe, expect, it } from 'vitest';
import { mean, sumOfSquaredDeviations } from '../../src/helpers/moments';

describe('moments', () => {
  it('mean', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(mean([-5])).toBe(-5);
    expect(mean([])).toMatchObject({ code: '#DIV/0!' });
  });

  it('sum of squared deviations', () => {
    expect(sumOfSquaredDeviations([4, 5, 8, 7, 11, 4, 3])).toBeCloseTo(48, 12);
    expect(sumOfSquaredDeviations([2, 2, 2])).toBe(0);
    expect(sumOfSquaredDeviations([])).toBe(0);
  });
});
