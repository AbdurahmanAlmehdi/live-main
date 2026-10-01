import { describe, expect, it } from 'vitest';
import { gcd, lcm } from '../../src/helpers/gcd';

describe('gcd / lcm', () => {
  it('computes the greatest common divisor', () => {
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(7, 13)).toBe(1);
    expect(gcd(0, 5)).toBe(5);
    expect(gcd(0, 0)).toBe(0);
  });

  it('computes the least common multiple', () => {
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(5, 7)).toBe(35);
    expect(lcm(3, 0)).toBe(0);
  });
});
