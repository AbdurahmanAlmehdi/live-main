import type { FormulaFunction } from '../../core/types';
import { toBoolean } from '../../core/coerce';
import { isError } from '../../core/errors';

/** NOT(logical): reverses a logical value. */
const NOT: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const b = toBoolean(value);
    if (isError(b)) return b;
    return !b;
  },
};

export default NOT;
