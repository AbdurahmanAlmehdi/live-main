import { describe, expect, it } from 'vitest';
import { err } from '../../src/core/errors';
import { collectCashflows, netPresentValue } from '../../src/helpers/cashflows';

describe('cash flows', () => {
  it('collects numbers from a scalar', () => {
    expect(collectCashflows(-100)).toEqual([-100]);
    expect(collectCashflows('x')).toEqual([]);
    expect(collectCashflows(err.div0)).toMatchObject({ code: '#DIV/0!' });
  });

  it('discounts flows from period 1', () => {
    expect(netPresentValue(0.1, [-10000, 3000, 4200, 6800])).toBeCloseTo(1188.44341233522, 9);
    expect(netPresentValue(0, [1, 2, 3])).toBe(6);
  });
});
