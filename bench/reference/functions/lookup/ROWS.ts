import type { FormulaFunction } from '../../core/types';
import { dimensions } from '../../core/range';
import { isError } from '../../core/errors';

/** ROWS(array): the number of rows in an array (1 for a single value). */
const ROWS: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([array]) {
    if (isError(array)) return array;
    const [height] = dimensions(array);
    return height;
  },
};

export default ROWS;
