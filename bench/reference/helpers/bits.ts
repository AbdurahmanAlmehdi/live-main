import type { FormulaError, Value } from '../core/value';
import { err, isError } from '../core/errors';
import { toNumber } from '../core/coerce';

/** Largest value the bitwise functions accept, exclusive: 2^48. */
export const BIT_LIMIT = 2 ** 48;

/**
 * Reads an operand for BITAND / BITOR / BITXOR / BITLSHIFT / BITRSHIFT: a whole
 * number with 0 <= n < 2^48. Non-integers and out-of-range values give #NUM!.
 */
export function toBitOperand(value: Value): number | FormulaError {
  const n = toNumber(value);
  if (isError(n)) return n;
  if (!Number.isInteger(n) || n < 0 || n >= BIT_LIMIT) return err.num;
  return n;
}
