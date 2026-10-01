import type { FormulaFunction } from '../../core/types';
import { isError } from '../../core/errors';

/** ISERROR(value): TRUE when the value is an error. */
const ISERROR: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    return isError(value);
  },
};

export default ISERROR;
