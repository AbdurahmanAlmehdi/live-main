import type { FormulaFunction } from '../../core/types';
import { toText } from '../../core/coerce';
import { isError } from '../../core/errors';

/** EXACT(text1, text2): TRUE when both texts are identical, case included. */
const EXACT: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([left, right]) {
    const a = toText(left);
    if (isError(a)) return a;
    const b = toText(right);
    if (isError(b)) return b;
    return a === b;
  },
};

export default EXACT;
