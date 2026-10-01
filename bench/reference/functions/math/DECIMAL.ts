import type { FormulaFunction } from '../../core/types';
import { toInteger, toText } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { parseRadix } from '../../helpers/radixParse';

/** DECIMAL(text, radix): the value of text written in base radix (2..36). */
const DECIMAL: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([textValue, radixValue]) {
    const text = toText(textValue);
    if (isError(text)) return text;
    const radix = toInteger(radixValue);
    if (isError(radix)) return radix;
    if (radix < 2 || radix > 36) return err.num;
    return parseRadix(text, radix, { signed: false, maxDigits: 255 });
  },
};

export default DECIMAL;
