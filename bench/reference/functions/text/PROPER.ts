import type { FormulaFunction } from '../../core/types';
import { toText } from '../../core/coerce';
import { isError } from '../../core/errors';

/** PROPER(text): upper-cases the first letter of every word (a word starts after any non-letter), lower-cases the rest. */
const PROPER: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const text = toText(value);
    if (isError(text)) return text;
    return text.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
  },
};

export default PROPER;
