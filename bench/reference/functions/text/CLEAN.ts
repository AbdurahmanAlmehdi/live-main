import type { FormulaFunction } from '../../core/types';
import { toText } from '../../core/coerce';
import { isError } from '../../core/errors';

/** CLEAN(text): removes the non-printable characters (codes 0-31). */
const CLEAN: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const text = toText(value);
    if (isError(text)) return text;
    // eslint-disable-next-line no-control-regex
    return text.replace(/[\x00-\x1f]/g, '');
  },
};

export default CLEAN;
