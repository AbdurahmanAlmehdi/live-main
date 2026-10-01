import type { FormulaFunction } from '../../core/types';
import { toInteger } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** CHAR(number): the character with code 1..255 (truncated). */
const CHAR: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const code = toInteger(value);
    if (isError(code)) return code;
    if (code < 1 || code > 255) return err.value;
    return String.fromCharCode(code);
  },
};

export default CHAR;
