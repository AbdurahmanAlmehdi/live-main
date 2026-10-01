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

function growth(rate: number, nper: number): number {
  return Math.exp(nper * Math.log1p(rate));
}

/** ((1 + rate)^nper - 1) / rate, accurate for rates close to 0. */
function annuityFactor(rate: number, nper: number): number {
  return Math.expm1(nper * Math.log1p(rate)) / rate;
}

/** Future value of an investment. */
export function futureValue(rate: number, nper: number, pmt: number, pv: number, type: number): number {
  if (rate === 0) return -(pv + pmt * nper);
  return -(pv * growth(rate, nper) + pmt * (1 + rate * type) * annuityFactor(rate, nper));
}

/** Present value of an investment. */
export function presentValue(rate: number, nper: number, pmt: number, fv: number, type: number): number {
  if (rate === 0) return -(fv + pmt * nper);
  return -(fv + pmt * (1 + rate * type) * annuityFactor(rate, nper)) / growth(rate, nper);
}

/** Periodic payment for a loan or investment. */
export function payment(rate: number, nper: number, pv: number, fv: number, type: number): number {
  if (rate === 0) return -(pv + fv) / nper;
  return -(pv * growth(rate, nper) + fv) / ((1 + rate * type) * annuityFactor(rate, nper));
}

/** Interest portion of the payment in period `per` (1-based), negative when interest is paid. */
export function interestPayment(rate: number, per: number, nper: number, pv: number, fv: number, type: number): number {
  const pmt = payment(rate, nper, pv, fv, type);
  let balance: number;
  if (per === 1) balance = type === 1 ? 0 : -pv;
  else if (type === 1) balance = futureValue(rate, per - 2, pmt, pv, 1) - pmt;
  else balance = futureValue(rate, per - 1, pmt, pv, 0);
  return balance * rate;
}
