import type { FormulaFunction } from '../../core/types';
import { isError } from '../../core/errors';

/** IFERROR(value, value_if_error): value_if_error when value is any error, otherwise value. */
const IFERROR: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([value, fallback]) {
    return isError(value) ? fallback : value;
  },
};

export default IFERROR;
