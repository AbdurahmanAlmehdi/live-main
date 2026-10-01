import type { FormulaFunction } from '../../core/types';

/** ISTEXT(value): TRUE when the value is text. */
const ISTEXT: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    return typeof value === 'string';
  },
};

export default ISTEXT;
