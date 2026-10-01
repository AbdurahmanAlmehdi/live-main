import type { FormulaError, Value } from '../core/value';
import { NotImplementedError } from '../core/errors';

/** A complex number as the IM* functions see it, remembering its "i" / "j" suffix. */
export interface Complex {
  re: number;
  im: number;
  suffix: 'i' | 'j';
}

/**
 * Reads a complex number from a value: a number is a real number; text must look like
 * "3+4i", "3-4j", "-2.5i", "i", "-j", "1e3+2i" or "7" ("" is 0). Booleans give
 * #VALUE!, malformed text gives #NUM!, errors pass through.
 */
export function parseComplex(value: Value): Complex | FormulaError {
  throw new NotImplementedError('parseComplex (src/helpers/complexParse.ts)');
}
