import { describe, expect, it } from 'vitest';
import { findApproximate } from '../../src/helpers/lookupApprox';

describe('findApproximate', () => {
  it('finds the largest value <= needle in ascending data', () => {
    expect(findApproximate(25, [10, 20, 30, 40], 'ascending')).toBe(1);
    expect(findApproximate(30, [10, 20, 30, 40], 'ascending')).toBe(2);
    expect(findApproximate(99, [10, 20, 30, 40], 'ascending')).toBe(3);
    expect(findApproximate(5, [10, 20, 30, 40], 'ascending')).toBe(-1);
  });

  it('finds the smallest value >= needle in descending data', () => {
    expect(findApproximate(25, [40, 30, 20, 10], 'descending')).toBe(1);
    expect(findApproximate(50, [40, 30, 20, 10], 'descending')).toBe(-1);
  });

  it('only considers cells of the needle\'s type', () => {
    expect(findApproximate('c', ['a', 'b', 'd'], 'ascending')).toBe(1);
    expect(findApproximate(15, [10, 'x', 20], 'ascending')).toBe(0);
  });
});
