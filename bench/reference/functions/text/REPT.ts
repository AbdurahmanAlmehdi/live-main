import type { FormulaFunction } from '../../core/types';
import { toInteger, toText } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** REPT(text, number_times): text repeated number_times (truncated) times; at most 32767 characters. */
const REPT: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([textValue, timesValue]) {
    const text = toText(textValue);
    if (isError(text)) return text;
    const times = toInteger(timesValue);
    if (isError(times)) return times;
    if (times < 0 || text.length * times > 32767) return err.value;
    return text.repeat(times);
  },
};

export default REPT;
