import { describe, expect, it } from 'vitest';
import { erf, erfc } from '../../src/helpers/erf';

describe('erf / erfc', () => {
  it('computes erf', () => {
    expect(erf(0)).toBe(0);
    expect(erf(0.5)).toBeCloseTo(0.5204998778130465, 14);
    expect(erf(1)).toBeCloseTo(0.8427007929497149, 14);
    expect(erf(-1)).toBeCloseTo(-0.8427007929497149, 14);
  });

  it('computes erfc accurately in the tail', () => {
    expect(erfc(1)).toBeCloseTo(0.15729920705028513, 14);
    expect(erfc(4)).toBeCloseTo(1.541725790028002e-8, 20);
    expect(erfc(-1)).toBeCloseTo(1.8427007929497148, 14);
  });
});
