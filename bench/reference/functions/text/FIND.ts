import type { FormulaFunction } from '../../core/types';
import { toText } from '../../core/coerce';
import { optionalInteger } from '../../core/args';
import { err, isError } from '../../core/errors';

/** FIND(find_text, within_text, [start_num]): 1-based position of find_text (case-sensitive); #VALUE! when absent. */
const FIND: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    const needle = toText(args[0]);
    if (isError(needle)) return needle;
    const haystack = toText(args[1]);
    if (isError(haystack)) return haystack;
    const start = optionalInteger(args, 2, 1);
    if (isError(start)) return start;
    if (start < 1 || start > haystack.length + 1) return err.value;
    const index = haystack.indexOf(needle, start - 1);
    return index < 0 ? err.value : index + 1;
  },
};

export default FIND;
