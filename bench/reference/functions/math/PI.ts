import type { FormulaFunction } from '../../core/types';

/** PI(): the number pi. */
const PI: FormulaFunction = {
  minArgs: 0,
  maxArgs: 0,
  call() {
    return Math.PI;
  },
};

export default PI;
