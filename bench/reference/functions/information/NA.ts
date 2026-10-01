import type { FormulaFunction } from '../../core/types';
import { err } from '../../core/errors';

/** NA(): the #N/A error. */
const NA: FormulaFunction = {
  minArgs: 0,
  maxArgs: 0,
  call() {
    return err.na;
  },
};

export default NA;
