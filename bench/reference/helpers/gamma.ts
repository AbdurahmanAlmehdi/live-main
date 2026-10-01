/** The gamma function, via the Lanczos approximation (about 15 significant digits). */

const G = 7;
const COEFFICIENTS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

function lanczosSum(x: number): number {
  let sum = COEFFICIENTS[0];
  for (let i = 1; i < G + 2; i++) sum += COEFFICIENTS[i] / (x + i);
  return sum;
}

/** ln Γ(x) for x > 0 (NaN otherwise). */
export function gammaLn(x: number): number {
  if (!(x > 0)) return NaN;
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - gammaLn(1 - x);
  const z = x - 1;
  const t = z + G + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(lanczosSum(z));
}

/** Γ(x); NaN at 0 and the negative integers (the poles). */
export function gamma(x: number): number {
  if (Number.isInteger(x) && x <= 0) return NaN;
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  if (Number.isInteger(x) && x <= 171) {
    let result = 1;
    for (let i = 2; i < x; i++) result *= i;
    return result;
  }
  const z = x - 1;
  const t = z + G + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * lanczosSum(z);
}
