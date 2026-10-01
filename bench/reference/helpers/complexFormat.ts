import type { Complex } from './complexParse';

/** Formats one component with at most 15 significant digits. */
function component(n: number): string {
  const rounded = Number(n.toPrecision(15));
  return String(rounded === 0 ? 0 : rounded).replace('e+', 'E+').replace('e-', 'E-');
}

/**
 * Text form of a complex number, as the IM* functions return it:
 * "3+4i", "3-4i", "4i", "i", "-i", "3", "0". A unit imaginary part is written without
 * the 1. Components use at most 15 significant digits.
 */
export function formatComplex(c: Complex): string {
  const re = Number(c.re.toPrecision(15));
  const im = Number(c.im.toPrecision(15));
  if (im === 0) return component(re);
  const imText = im === 1 ? '' : im === -1 ? '-' : component(im);
  const imagPart = `${imText}${c.suffix}`;
  if (re === 0) return imagPart;
  return `${component(re)}${im > 0 ? '+' : ''}${imagPart}`;
}
