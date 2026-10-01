import type { FormulaFunction } from '../../core/types';
import { parseNumber, toNumber, toText } from '../../core/coerce';
import { isError } from '../../core/errors';
import { formatWithPattern } from '../../helpers/textFormat';

/** TEXT(value, format_text): formats a number with a format code; non-numeric text is returned unchanged. */
const TEXT: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([value, formatValue]) {
    const format = toText(formatValue);
    if (isError(format)) return format;
    if (typeof value === 'string' && parseNumber(value) === null) return value;
    const n = toNumber(value);
    if (isError(n)) return n;
    return formatWithPattern(n, format);
  },
};

export default TEXT;
