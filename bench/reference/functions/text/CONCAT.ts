import type { FormulaFunction } from '../../core/types';
import { flattenArgs } from '../../core/args';
import { toText } from '../../core/coerce';
import { isError } from '../../core/errors';

/** CONCAT(text1, ...): joins all arguments, array cells included, as text. */
const CONCAT: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    let out = '';
    for (const cell of flattenArgs(args)) {
      const text = toText(cell);
      if (isError(text)) return text;
      out += text;
    }
    return out;
  },
};

export default CONCAT;
