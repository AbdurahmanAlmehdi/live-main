import type { FormulaFunction } from '../../core/types';
import { toText } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** UNICODE(text): the code point of the first character. */
const UNICODE: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const text = toText(value);
    if (isError(text)) return text;
    const code = text.codePointAt(0);
    return code === undefined ? err.value : code;
  },
};

export default UNICODE;
