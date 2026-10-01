import { erfc } from './erf';

/** The standard normal distribution. */

/** Density φ(z). */
export function normalPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

/** Cumulative Φ(z). */
export function normalCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

// Acklam's rational approximation, refined below with one Halley step.
const A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
const B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
const C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
const P_LOW = 0.02425;

function acklam(p: number): number {
  if (p < P_LOW) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  }
  if (p > 1 - P_LOW) return -acklam(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q) / (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
}

/** Inverse Φ⁻¹(p) for 0 < p < 1 (NaN otherwise). */
export function normalInv(p: number): number {
  if (!(p > 0 && p < 1)) return NaN;
  let x = acklam(p);
  for (let i = 0; i < 2; i++) {
    const e = normalCdf(x) - p;
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
    x -= u / (1 + (x * u) / 2);
  }
  return x;
}
