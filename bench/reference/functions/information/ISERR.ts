import type { FormulaFunction } from '../../core/types';
import { isError } from '../../core/errors';

/** ISERR(value): TRUE when the value is an error other than #N/A. */
const ISERR: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    return isError(value) && value.code !== '#N/A';
  },
};

export default ISERR;
