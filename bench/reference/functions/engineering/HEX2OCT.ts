import type { FormulaFunction } from '../../core/types';
import { toInteger, toText } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { parseRadix } from '../../helpers/radixParse';
import { formatRadix } from '../../helpers/radixFormat';

/** HEX2OCT(number, [places]): a hexadecimal number written in octal, zero-padded to places digits (two's complement for negatives). */
const HEX2OCT: FormulaFunction = {
  minArgs: 1,
  maxArgs: 2,
  call(args) {
    if (typeof args[0] === 'boolean') return err.value;
    const text = toText(args[0]);
    if (isError(text)) return text;
    const n = parseRadix(text, 16);
    if (isError(n)) return n;
    const places = args.length > 1 ? toInteger(args[1]) : undefined;
    if (isError(places)) return places;
    return formatRadix(n, 8, places);
  },
};

export default HEX2OCT;
