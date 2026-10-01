import { describe, expect, it } from 'vitest';
import { futureValue, interestPayment, payment, presentValue } from '../../src/helpers/annuity';

describe('annuity relations', () => {
  it('futureValue', () => {
    expect(futureValue(0.06 / 12, 10, -200, -500, 1)).toBeCloseTo(2581.4033740601, 9);
    expect(futureValue(0, 10, -100, 0, 0)).toBe(1000);
  });

  it('presentValue', () => {
    expect(presentValue(0.08 / 12, 240, 500, 0, 0)).toBeCloseTo(-59777.1458511878, 8);
    expect(presentValue(0, 10, -100, 0, 0)).toBe(1000);
  });

  it('payment', () => {
    expect(payment(0.08 / 12, 10, 10000, 0, 0)).toBeCloseTo(-1037.03208935915, 9);
    expect(payment(0.08 / 12, 10, 10000, 0, 1)).toBeCloseTo(-1030.16432717797, 9);
    expect(payment(0, 10, 1000, 0, 0)).toBe(-100);
  });

  it('interestPayment', () => {
    expect(interestPayment(0.1 / 12, 1, 36, 8000, 0, 0)).toBeCloseTo(-66.6666666666667, 9);
    expect(interestPayment(0.1, 3, 3, 8000, 0, 0)).toBeCloseTo(-292.447129909366, 9);
    expect(interestPayment(0.1, 1, 3, 8000, 0, 1)).toBe(0);
  });
});
