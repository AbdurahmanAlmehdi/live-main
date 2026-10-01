import type { FormulaFunction } from '../../core/types';

/** FALSE(): the logical value FALSE. */
const FALSE: FormulaFunction = {
  minArgs: 0,
  maxArgs: 0,
  call() {
    return false;
  },
};

export default FALSE;
