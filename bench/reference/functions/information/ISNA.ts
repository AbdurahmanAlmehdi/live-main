import type { FormulaFunction } from '../../core/types';
import { isErrorCode } from '../../core/errors';

/** ISNA(value): TRUE when the value is #N/A. */
const ISNA: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    return isErrorCode(value, '#N/A');
  },
};

export default ISNA;
