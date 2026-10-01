import type { FormulaFunction } from '../../core/types';

/** ISNUMBER(value): TRUE when the value is a number. */
const ISNUMBER: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    return typeof value === 'number';
  },
};

export default ISNUMBER;
