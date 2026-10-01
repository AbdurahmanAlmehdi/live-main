import type { FormulaFunction } from '../../core/types';
import { toText } from '../../core/coerce';
import { isError } from '../../core/errors';

/** CONCATENATE(text1, ...): joins its arguments as text. */
const CONCATENATE: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    let out = '';
    for (const arg of args) {
      const text = toText(arg);
      if (isError(text)) return text;
      out += text;
    }
    return out;
  },
};

export default CONCATENATE;
