import type { FormulaFunction } from '../../core/types';
import { isErrorCode } from '../../core/errors';

/** IFNA(value, value_if_na): value_if_na when value is #N/A, otherwise value. */
const IFNA: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([value, fallback]) {
    return isErrorCode(value, '#N/A') ? fallback : value;
  },
};

export default IFNA;
