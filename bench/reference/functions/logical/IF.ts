import type { FormulaFunction } from '../../core/types';
import { toBoolean } from '../../core/coerce';
import { isError } from '../../core/errors';

/**
 * IF(logical_test, [value_if_true], [value_if_false]): picks a value by a test. An omitted
 * value_if_false gives FALSE; an empty chosen value gives 0.
 */
const IF: FormulaFunction = {
  minArgs: 1,
  maxArgs: 3,
  call(args) {
    const test = toBoolean(args[0]);
    if (isError(test)) return test;
    if (!test && args.length < 3) return false;
    const chosen = test ? args[1] : args[2];
    return chosen === null || chosen === undefined ? 0 : chosen;
  },
};

export default IF;
