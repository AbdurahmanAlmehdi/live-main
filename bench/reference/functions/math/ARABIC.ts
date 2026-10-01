import type { FormulaFunction } from '../../core/types';
import { toText } from '../../core/coerce';
import { isError } from '../../core/errors';
import { fromRoman } from '../../helpers/roman';

/** ARABIC(text): the value of a roman numeral. */
const ARABIC: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const text = toText(value);
    if (isError(text)) return text;
    return fromRoman(text);
  },
};

export default ARABIC;
