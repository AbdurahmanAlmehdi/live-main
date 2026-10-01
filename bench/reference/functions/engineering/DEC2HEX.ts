import type { FormulaFunction } from '../../core/types';
import { toInteger } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { formatRadix } from '../../helpers/radixFormat';

/** DEC2HEX(number, [places]): a decimal integer (truncated) written in hexadecimal, zero-padded to places digits (two's complement for negatives). */
const DEC2HEX: FormulaFunction = {
  minArgs: 1,
  maxArgs: 2,
  call(args) {
    if (typeof args[0] === 'boolean') return err.value;
    const n = toInteger(args[0]);
    if (isError(n)) return n;
    const places = args.length > 1 ? toInteger(args[1]) : undefined;
    if (isError(places)) return places;
    return formatRadix(n, 16, places);
  },
};

export default DEC2HEX;
