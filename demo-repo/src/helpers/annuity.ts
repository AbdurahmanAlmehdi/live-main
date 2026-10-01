import { NotImplementedError } from '../core/errors';

/**
 * Time-value-of-money relations for a level annuity, using the spreadsheet sign
 * convention (money paid out is negative). `type` is 0 for payments at the end of each
 * period and 1 for payments at the beginning. Results may be non-finite for extreme
 * inputs; callers map those to #NUM!.
 *
 * These functions all solve the same equation:
 *   pv·(1+r)^n + pmt·(1 + r·type)·((1+r)^n − 1)/r + fv = 0     (r ≠ 0)
 *   pv + pmt·n + fv = 0                                        (r = 0)
 */

/** Future value of an investment. */
export function futureValue(rate: number, nper: number, pmt: number, pv: number, type: number): number {
  throw new NotImplementedError('futureValue (src/helpers/annuity.ts)');
}

/** Present value of an investment. */
export function presentValue(rate: number, nper: number, pmt: number, fv: number, type: number): number {
  throw new NotImplementedError('presentValue (src/helpers/annuity.ts)');
}

/** Periodic payment for a loan or investment. */
export function payment(rate: number, nper: number, pv: number, fv: number, type: number): number {
  throw new NotImplementedError('payment (src/helpers/annuity.ts)');
}

/** Interest portion of the payment in period `per` (1-based), negative when interest is paid. */
export function interestPayment(rate: number, per: number, nper: number, pv: number, fv: number, type: number): number {
  throw new NotImplementedError('interestPayment (src/helpers/annuity.ts)');
}
