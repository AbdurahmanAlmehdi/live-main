import type { FormulaError, Value } from '../core/value';
import { isError } from '../core/errors';
import { cellsOf } from '../core/range';

/**
 * The numbers in a cash-flow argument (NPV, IRR, MIRR, XNPV, ...), in order. Text,
 * booleans and empty cells are skipped; the first error is returned.
 */
export function collectCashflows(values: Value): number[] | FormulaError {
  const flows: number[] = [];
  for (const cell of cellsOf(values)) {
    if (isError(cell)) return cell;
    if (typeof cell === 'number') flows.push(cell);
  }
  return flows;
}

/** Net present value of flows at the end of periods 1, 2, 3, ... */
export function netPresentValue(rate: number, flows: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < flows.length; i++) total += flows[i] / Math.pow(1 + rate, i + 1);
  return total;
}
