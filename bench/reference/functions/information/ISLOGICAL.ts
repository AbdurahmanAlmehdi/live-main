import type { FormulaFunction } from '../../core/types';

/** ISLOGICAL(value): TRUE when the value is a logical value. */
const ISLOGICAL: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    return typeof value === 'boolean';
  },
};

export default ISLOGICAL;
