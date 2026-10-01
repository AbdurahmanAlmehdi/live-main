import type { FormulaFunction } from '../../core/types';
import { toText } from '../../core/coerce';
import { optionalInteger } from '../../core/args';
import { err, isError } from '../../core/errors';

/** RIGHT(text, [num_chars]): the last num_chars characters (1 by default). */
const RIGHT: FormulaFunction = {
  minArgs: 1,
  maxArgs: 2,
  call(args) {
    const text = toText(args[0]);
    if (isError(text)) return text;
    const count = optionalInteger(args, 1, 1);
    if (isError(count)) return count;
    if (count < 0) return err.value;
    return count === 0 ? '' : text.slice(-count);
  },
};

export default RIGHT;
