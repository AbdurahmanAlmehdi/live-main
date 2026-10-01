import type { FormulaFunction } from '../../core/types';
import { flattenArgs } from '../../core/args';
import { toBoolean, toText } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/**
 * TEXTJOIN(delimiter, ignore_empty, text1, ...): joins texts and array cells with a
 * delimiter; when ignore_empty is TRUE, empty texts are skipped.
 */
const TEXTJOIN: FormulaFunction = {
  minArgs: 3,
  maxArgs: Infinity,
  call([delimiterValue, ignoreValue, ...texts]) {
    const delimiter = toText(delimiterValue);
    if (isError(delimiter)) return delimiter;
    const ignoreEmpty = toBoolean(ignoreValue);
    if (isError(ignoreEmpty)) return ignoreEmpty;
    const parts: string[] = [];
    for (const cell of flattenArgs(texts)) {
      const text = toText(cell);
      if (isError(text)) return text;
      if (ignoreEmpty && text === '') continue;
      parts.push(text);
    }
    const joined = parts.join(delimiter);
    return joined.length > 32767 ? err.value : joined;
  },
};

export default TEXTJOIN;
