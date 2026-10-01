import type { FormulaFunction } from '../../core/types';
import { toText } from '../../core/coerce';
import { isError } from '../../core/errors';

/** TRIM(text): removes leading/trailing spaces and collapses runs of spaces to one. */
const TRIM: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const text = toText(value);
    if (isError(text)) return text;
    return text.replace(/ +/g, ' ').replace(/^ | $/g, '');
  },
};

export default TRIM;
