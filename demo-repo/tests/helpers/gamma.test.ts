import { describe, expect, it } from 'vitest';
import { gamma, gammaLn } from '../../src/helpers/gamma';

describe('gamma', () => {
  it('matches factorials at integers', () => {
    expect(gamma(5)).toBe(24);
    expect(gamma(1)).toBe(1);
  });

  it('handles fractions and negative non-integers', () => {
    expect(gamma(0.5)).toBeCloseTo(Math.sqrt(Math.PI), 13);
    expect(gamma(2.5)).toBeCloseTo(1.329340388179137, 13);
    expect(gamma(-1.5)).toBeCloseTo(2.363271801207355, 12);
  });

  it('is undefined at the poles', () => {
    expect(gamma(0)).toBeNaN();
    expect(gamma(-2)).toBeNaN();
  });
});

describe('gammaLn', () => {
  it('computes ln Γ(x) for positive x', () => {
    expect(gammaLn(4)).toBeCloseTo(Math.log(6), 13);
    expect(gammaLn(0.5)).toBeCloseTo(0.5723649429247001, 13);
    expect(gammaLn(100)).toBeCloseTo(359.1342053695754, 10);
  });

  it('is NaN for x <= 0', () => {
    expect(gammaLn(0)).toBeNaN();
    expect(gammaLn(-1)).toBeNaN();
  });
});
