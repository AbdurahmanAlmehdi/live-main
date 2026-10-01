import { describe, expect, it } from 'vitest';
import { regularizedGammaP, regularizedGammaQ } from '../../src/helpers/incompleteGamma';

describe('regularized incomplete gamma', () => {
  it('P(1, x) is 1 - e^-x', () => {
    expect(regularizedGammaP(1, 2)).toBeCloseTo(1 - Math.exp(-2), 14);
    expect(regularizedGammaQ(1, 2)).toBeCloseTo(Math.exp(-2), 14);
  });

  it('handles both the series and the continued-fraction regions', () => {
    expect(regularizedGammaP(3, 1)).toBeCloseTo(0.08030139707139415, 14);
    expect(regularizedGammaP(3, 10)).toBeCloseTo(0.9972306042844884, 14);
    expect(regularizedGammaQ(0.5, 16)).toBeCloseTo(1.541725790028002e-8, 20);
  });

  it('has the right limits', () => {
    expect(regularizedGammaP(2, 0)).toBe(0);
    expect(regularizedGammaQ(2, 0)).toBe(1);
  });
});
