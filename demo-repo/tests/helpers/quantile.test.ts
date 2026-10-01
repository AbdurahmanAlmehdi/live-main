import { describe, expect, it } from 'vitest';
import { percentileInclusive } from '../../src/helpers/quantile';

describe('percentileInclusive', () => {
  it('interpolates between sorted values', () => {
    expect(percentileInclusive([1, 2, 3, 4], 0.3)).toBeCloseTo(1.9, 12);
    expect(percentileInclusive([4, 1, 3, 2], 0.5)).toBe(2.5);
    expect(percentileInclusive([10, 20, 30], 0)).toBe(10);
    expect(percentileInclusive([10, 20, 30], 1)).toBe(30);
  });

  it('rejects k outside [0, 1] and empty lists', () => {
    expect(percentileInclusive([1, 2], 1.5)).toMatchObject({ code: '#NUM!' });
    expect(percentileInclusive([1, 2], -0.1)).toMatchObject({ code: '#NUM!' });
    expect(percentileInclusive([], 0.5)).toMatchObject({ code: '#NUM!' });
  });
});
