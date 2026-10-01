import type { FormulaFunction } from '../../core/types';
import { isRange } from '../../core/value';
import { isError } from '../../core/errors';

/** TYPE(value): 1 number, 2 text, 4 logical, 16 error, 64 array. */
const TYPE: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    if (isRange(value)) return 64;
    if (isError(value)) return 16;
    if (typeof value === 'string') return 2;
    if (typeof value === 'boolean') return 4;
    return 1;
  },
};

export default TYPE;
