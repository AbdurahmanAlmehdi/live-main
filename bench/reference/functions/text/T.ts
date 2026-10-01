import type { FormulaFunction } from '../../core/types';
import { isError } from '../../core/errors';

/** T(value): the value when it is text, otherwise "" (errors pass through). */
const T: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    if (isError(value)) return value;
    return typeof value === 'string' ? value : '';
  },
};

export default T;
