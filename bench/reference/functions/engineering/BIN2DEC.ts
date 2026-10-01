import type { FormulaFunction } from '../../core/types';
import { toText } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { parseRadix } from '../../helpers/radixParse';

/** BIN2DEC(number): the decimal value of a binary number (at most 10 digits, two's complement). */
const BIN2DEC: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    if (typeof value === 'boolean') return err.value;
    const text = toText(value);
    if (isError(text)) return text;
    return parseRadix(text, 2);
  },
};

export default BIN2DEC;
