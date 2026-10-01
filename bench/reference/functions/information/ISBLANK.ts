import type { FormulaFunction } from '../../core/types';

/** ISBLANK(value): TRUE when the value is empty. */
const ISBLANK: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    return value === null;
  },
};

export default ISBLANK;
