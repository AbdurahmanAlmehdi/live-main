import type { FormulaError } from '../core/value';
import { err } from '../core/errors';

export interface SolveOptions {
  /** Stop when |f(x)| or the step falls below this (default 1e-10). */
  tolerance?: number;
  /** Give up after this many iterations (default 100). */
  maxIterations?: number;
}

/**
 * Finds a root of `f` near `guess` with Newton's method, using a numerical derivative.
 * Used by RATE, IRR and XIRR. #NUM! when it does not converge or leaves the finite
 * numbers.
 */
export function solveNewton(f: (x: number) => number, guess: number, options: SolveOptions = {}): number | FormulaError {
  const tolerance = options.tolerance ?? 1e-10;
  const maxIterations = options.maxIterations ?? 100;
  let x = guess;
  for (let i = 0; i < maxIterations; i++) {
    const y = f(x);
    if (!Number.isFinite(y)) return err.num;
    if (Math.abs(y) < tolerance) return x;
    const h = Math.max(Math.abs(x), 1) * 1e-7;
    const slope = (f(x + h) - f(x - h)) / (2 * h);
    if (!Number.isFinite(slope) || slope === 0) return err.num;
    const next = x - y / slope;
    if (!Number.isFinite(next)) return err.num;
    if (Math.abs(next - x) < tolerance * Math.max(1, Math.abs(x))) return next;
    x = next;
  }
  return err.num;
}
