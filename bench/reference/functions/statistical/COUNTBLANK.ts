import type { FormulaFunction } from '../../core/types';
import { cellsOf } from '../../core/range';

/** COUNTBLANK(range): how many cells are empty or empty text. */
const COUNTBLANK: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([range]) {
    return cellsOf(range).filter((cell) => cell === null || cell === '').length;
  },
};

export default COUNTBLANK;
