import type { FormulaFunction } from '../../core/types';
import { toRange, transpose } from '../../core/range';
import { isError } from '../../core/errors';

/** TRANSPOSE(array): the array with rows and columns swapped. */
const TRANSPOSE: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([array]) {
    if (isError(array)) return array;
    return transpose(toRange(array));
  },
};

export default TRANSPOSE;
