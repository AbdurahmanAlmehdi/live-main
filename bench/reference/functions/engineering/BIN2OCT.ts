import type { FormulaFunction } from '../../core/types';
import { toInteger, toText } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { parseRadix } from '../../helpers/radixParse';
import { formatRadix } from '../../helpers/radixFormat';

/** BIN2OCT(number, [places]): a binary number written in octal, zero-padded to places digits (two's complement for negatives). */
const BIN2OCT: FormulaFunction = {
  minArgs: 1,
  maxArgs: 2,
  call(args) {
    if (typeof args[0] === 'boolean') return err.value;
    const text = toText(args[0]);
    if (isError(text)) return text;
    const n = parseRadix(text, 2);
    if (isError(n)) return n;
    const places = args.length > 1 ? toInteger(args[1]) : undefined;
    if (isError(places)) return places;
    return formatRadix(n, 8, places);
  },
};

export default BIN2OCT;
