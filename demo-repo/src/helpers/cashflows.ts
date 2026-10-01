import type { FormulaError, Value } from '../core/value';
import { NotImplementedError } from '../core/errors';

/**
 * The numbers in a cash-flow argument (NPV, IRR, MIRR, XNPV, ...), in order. Text,
 * booleans and empty cells are skipped; the first error is returned.
 */
export function collectCashflows(values: Value): number[] | FormulaError {
  throw new NotImplementedError('collectCashflows (src/helpers/cashflows.ts)');
}

/** Net present value of flows at the end of periods 1, 2, 3, ... */
export function netPresentValue(rate: number, flows: readonly number[]): number {
  throw new NotImplementedError('netPresentValue (src/helpers/cashflows.ts)');
}
