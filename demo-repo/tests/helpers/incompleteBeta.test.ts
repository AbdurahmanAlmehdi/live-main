import { describe, expect, it } from 'vitest';
import { regularizedBeta } from '../../src/helpers/incompleteBeta';

describe('regularizedBeta', () => {
  it('I_x(1, 1) is x', () => {
    expect(regularizedBeta(0.3, 1, 1)).toBeCloseTo(0.3, 14);
  });

  it('matches known values', () => {
    expect(regularizedBeta(0.5, 2, 3)).toBeCloseTo(0.6875, 14);
    expect(regularizedBeta(0.2, 2, 5)).toBeCloseTo(0.34464, 14);
    expect(regularizedBeta(0.9, 5, 2)).toBeCloseTo(0.885735, 13);
  });

  it('has the right limits', () => {
    expect(regularizedBeta(0, 2, 3)).toBe(0);
    expect(regularizedBeta(1, 2, 3)).toBe(1);
  });
});
