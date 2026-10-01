import type { FormulaFunction } from '../../core/types';
import { isRange } from '../../core/value';
import { scalarsEqual } from '../../core/compare';
import { err, isError } from '../../core/errors';

/**
 * SWITCH(expression, value1, result1, ..., [default]): the result for the first value equal
 * to expression (text compares case-insensitively), else the default, else #N/A.
 */
const SWITCH: FormulaFunction = {
  minArgs: 3,
  maxArgs: Infinity,
  call([expression, ...rest]) {
    if (isError(expression)) return expression;
    if (isRange(expression)) return err.value;
    const pairs = Math.floor(rest.length / 2);
    for (let i = 0; i < pairs; i++) {
      const candidate = rest[2 * i];
      if (isError(candidate)) return candidate;
      if (!isRange(candidate) && scalarsEqual(expression, candidate)) return rest[2 * i + 1];
    }
    return rest.length % 2 === 1 ? rest[rest.length - 1] : err.na;
  },
};

export default SWITCH;
