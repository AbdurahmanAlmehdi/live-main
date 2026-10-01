import { describe, expect, it } from 'vitest';
import { roundAwayFromZero, roundHalfAwayFromZero, roundTowardZero } from '../../src/helpers/rounding';

describe('roundHalfAwayFromZero', () => {
  it('rounds halves away from zero', () => {
    expect(roundHalfAwayFromZero(2.5, 0)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5, 0)).toBe(-3);
    expect(roundHalfAwayFromZero(1.45, 1)).toBe(1.5);
  });

  it('works on the decimal value, not the binary one', () => {
    expect(roundHalfAwayFromZero(2.675, 2)).toBe(2.68);
    expect(roundHalfAwayFromZero(1.005, 2)).toBe(1.01);
  });

  it('supports negative digits', () => {
    expect(roundHalfAwayFromZero(1250, -2)).toBe(1300);
    expect(roundHalfAwayFromZero(-1249, -2)).toBe(-1200);
  });
});

describe('roundAwayFromZero / roundTowardZero', () => {
  it('round up and down in magnitude', () => {
    expect(roundAwayFromZero(3.21, 1)).toBe(3.3);
    expect(roundAwayFromZero(-3.21, 1)).toBe(-3.3);
    expect(roundTowardZero(3.29, 1)).toBe(3.2);
    expect(roundTowardZero(-3.29, 1)).toBe(-3.2);
  });

  it('leave exact values alone', () => {
    expect(roundAwayFromZero(3.2, 1)).toBe(3.2);
    expect(roundTowardZero(0.3, 1)).toBe(0.3);
    expect(roundAwayFromZero(0, 2)).toBe(0);
  });

  it('support negative digits', () => {
    expect(roundAwayFromZero(1201, -2)).toBe(1300);
    expect(roundTowardZero(1299, -2)).toBe(1200);
  });
});
