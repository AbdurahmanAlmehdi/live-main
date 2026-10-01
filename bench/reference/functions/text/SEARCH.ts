import type { FormulaFunction } from '../../core/types';
import { toText } from '../../core/coerce';
import { optionalInteger } from '../../core/args';
import { err, isError } from '../../core/errors';
import { wildcardToRegExp } from '../../helpers/wildcard';

/**
 * SEARCH(find_text, within_text, [start_num]): 1-based position of find_text, ignoring case;
 * find_text may use the wildcards * ? and ~. #VALUE! when absent.
 */
const SEARCH: FormulaFunction = {
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
    const match = wildcardToRegExp(needle, { anchored: false }).exec(haystack.slice(start - 1));
    return match ? match.index + start : err.value;
  },
};

export default SEARCH;
