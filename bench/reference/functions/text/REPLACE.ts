import type { FormulaFunction } from '../../core/types';
import { toInteger, toText } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** REPLACE(old_text, start_num, num_chars, new_text): replaces num_chars characters from start_num with new_text. */
const REPLACE: FormulaFunction = {
  minArgs: 4,
  maxArgs: 4,
  call([textValue, startValue, countValue, newValue]) {
    const text = toText(textValue);
    if (isError(text)) return text;
    const start = toInteger(startValue);
    if (isError(start)) return start;
    const count = toInteger(countValue);
    if (isError(count)) return count;
    const replacement = toText(newValue);
    if (isError(replacement)) return replacement;
    if (start < 1 || count < 0) return err.value;
    return text.slice(0, start - 1) + replacement + text.slice(start - 1 + count);
  },
};

export default REPLACE;
