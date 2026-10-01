import type { FormulaFunction } from '../../core/types';
import { toText } from '../../core/coerce';
import { optionalInteger } from '../../core/args';
import { err, isError } from '../../core/errors';

/** LEFT(text, [num_chars]): the first num_chars characters (1 by default). */
const LEFT: FormulaFunction = {
  minArgs: 1,
  maxArgs: 2,
  call(args) {
    const text = toText(args[0]);
    if (isError(text)) return text;
    const count = optionalInteger(args, 1, 1);
    if (isError(count)) return count;
    if (count < 0) return err.value;
    return text.slice(0, count);
  },
};

export default LEFT;
