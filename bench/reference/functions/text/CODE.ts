import type { FormulaFunction } from '../../core/types';
import { toText } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** CODE(text): the code of the first character. */
const CODE: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const text = toText(value);
    if (isError(text)) return text;
    if (text === '') return err.value;
    return text.charCodeAt(0);
  },
};

export default CODE;
