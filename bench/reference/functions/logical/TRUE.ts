import type { FormulaFunction } from '../../core/types';

/** TRUE(): the logical value TRUE. */
const TRUE: FormulaFunction = {
  minArgs: 0,
  maxArgs: 0,
  call() {
    return true;
  },
};

export default TRUE;
