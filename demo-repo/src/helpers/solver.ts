import type { FormulaError } from '../core/value';
import { NotImplementedError } from '../core/errors';

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
  throw new NotImplementedError('solveNewton (src/helpers/solver.ts)');
}
