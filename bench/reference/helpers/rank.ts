import type { FormulaError } from '../core/value';
import { err } from '../core/errors';

/**
 * Rank of `value` within `values` (RANK.EQ): 1 for the largest when descending, 1 for the
 * smallest when ascending. Ties share the best rank. #N/A when `value` is not in the list.
 */
export function rankOf(value: number, values: readonly number[], ascending: boolean): number | FormulaError {
  if (!values.includes(value)) return err.na;
  let better = 0;
  for (const v of values) {
    if (ascending ? v < value : v > value) better++;
  }
  return better + 1;
}
