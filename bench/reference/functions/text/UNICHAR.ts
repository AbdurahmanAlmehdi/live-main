import type { FormulaFunction } from '../../core/types';
import { toInteger } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** UNICHAR(number): the character for a Unicode code point (1..0x10FFFF). */
const UNICHAR: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const code = toInteger(value);
    if (isError(code)) return code;
    if (code < 1 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return err.value;
    return String.fromCodePoint(code);
  },
};

export default UNICHAR;
