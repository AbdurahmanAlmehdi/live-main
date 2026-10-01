import type { Value } from './value';

/** What the evaluator passes to a function besides its arguments. */
export interface EvalContext {
  /** The (upper-case) name the function was called by, e.g. "SUM". */
  readonly functionName: string;
}

/**
 * A spreadsheet function. Arguments arrive already evaluated (errors included, as
 * values); the evaluator checks the argument count against minArgs/maxArgs before
 * calling. Functions return error values, they never throw them.
 */
export interface FormulaFunction {
  /** Minimum number of arguments. */
  minArgs: number;
  /** Maximum number of arguments (Infinity for variadic functions). */
  maxArgs: number;
  call(args: Value[], ctx: EvalContext): Value;
}

/** The shape of a module under src/functions: it default-exports one function. */
export interface FunctionModule {
  default: FormulaFunction;
}

/** Loads a function module on demand (see registry.ts). */
export type FunctionLoader = () => Promise<FunctionModule>;
