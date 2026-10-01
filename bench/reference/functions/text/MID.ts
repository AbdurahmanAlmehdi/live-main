import type { FormulaFunction } from '../../core/types';
import { toInteger, toText } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** MID(text, start_num, num_chars): num_chars characters from 1-based position start_num. */
const MID: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call([textValue, startValue, countValue]) {
    const text = toText(textValue);
    if (isError(text)) return text;
    const start = toInteger(startValue);
    if (isError(start)) return start;
    const count = toInteger(countValue);
    if (isError(count)) return count;
    if (start < 1 || count < 0) return err.value;
    return text.slice(start - 1, start - 1 + count);
  },
};

export default MID;
