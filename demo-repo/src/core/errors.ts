import { FormulaError, type ErrorCode } from './value';

/**
 * The spreadsheet error values. Functions return these; they never throw them.
 *
 *   err.div0   #DIV/0!   division by zero, mean of nothing, ...
 *   err.value  #VALUE!   wrong type of argument (text where a number is needed, ...)
 *   err.num    #NUM!     invalid numeric argument or result (SQRT(-1), overflow, no convergence)
 *   err.na     #N/A      value not available (lookup miss)
 *   err.name   #NAME?    unknown function or name
 *   err.ref    #REF!     invalid reference / index out of bounds
 *   err.null   #NULL!    empty intersection
 */
export const err = Object.freeze({
  null: new FormulaError('#NULL!'),
  div0: new FormulaError('#DIV/0!'),
  value: new FormulaError('#VALUE!'),
  ref: new FormulaError('#REF!'),
  name: new FormulaError('#NAME?'),
  num: new FormulaError('#NUM!'),
  na: new FormulaError('#N/A'),
});

export function isError(value: unknown): value is FormulaError {
  return value instanceof FormulaError;
}

export function isErrorCode(value: unknown, code: ErrorCode): boolean {
  return isError(value) && value.code === code;
}

/** The error for a code, e.g. `errorFromCode('#N/A') === err.na`. */
export function errorFromCode(code: ErrorCode): FormulaError {
  switch (code) {
    case '#NULL!': return err.null;
    case '#DIV/0!': return err.div0;
    case '#VALUE!': return err.value;
    case '#REF!': return err.ref;
    case '#NAME?': return err.name;
    case '#NUM!': return err.num;
    case '#N/A': return err.na;
  }
}

/**
 * Returns the first argument that is an error, or undefined.
 * Typical use: `const e = firstError(a, b); if (e) return e;`
 */
export function firstError(...values: unknown[]): FormulaError | undefined {
  for (const value of values) {
    if (isError(value)) return value;
  }
  return undefined;
}

/**
 * Thrown (not returned) by helpers that have not been written yet.
 * A function that hits one of these fails its tests with a clear message.
 */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} is not implemented yet`);
    this.name = 'NotImplementedError';
  }
}
