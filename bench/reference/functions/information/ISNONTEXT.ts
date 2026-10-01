import type { FormulaFunction } from '../../core/types';

/** ISNONTEXT(value): TRUE when the value is not text. */
const ISNONTEXT: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    return typeof value !== 'string';
  },
};

export default ISNONTEXT;
