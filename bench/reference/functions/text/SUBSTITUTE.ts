import type { FormulaFunction } from '../../core/types';
import { toInteger, toText } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/**
 * SUBSTITUTE(text, old_text, new_text, [instance_num]): replaces every occurrence of
 * old_text, or only the instance_num-th one.
 */
const SUBSTITUTE: FormulaFunction = {
  minArgs: 3,
  maxArgs: 4,
  call(args) {
    const text = toText(args[0]);
    if (isError(text)) return text;
    const search = toText(args[1]);
    if (isError(search)) return search;
    const replacement = toText(args[2]);
    if (isError(replacement)) return replacement;
    if (args.length < 4 || args[3] === null) {
      return search === '' ? text : text.split(search).join(replacement);
    }
    const instance = toInteger(args[3]);
    if (isError(instance)) return instance;
    if (instance < 1) return err.value;
    if (search === '') return text;
    let index = -1;
    for (let i = 0; i < instance; i++) {
      index = text.indexOf(search, index + 1);
      if (index < 0) return text;
    }
    return text.slice(0, index) + replacement + text.slice(index + search.length);
  },
};

export default SUBSTITUTE;
