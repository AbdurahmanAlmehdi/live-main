import type { FormulaFunction } from '../../core/types';
import { dimensions } from '../../core/range';
import { isError } from '../../core/errors';

/** COLUMNS(array): the number of columns in an array (1 for a single value). */
const COLUMNS: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([array]) {
    if (isError(array)) return array;
    const [, width] = dimensions(array);
    return width;
  },
};

export default COLUMNS;
