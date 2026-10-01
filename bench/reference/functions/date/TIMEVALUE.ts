import type { FormulaFunction } from '../../core/types';
import { toText } from '../../core/coerce';
import { isError } from '../../core/errors';
import { parseTimeText } from '../../helpers/dateParse';

/** TIMEVALUE(time_text): the fraction of a day for a time written as text. */
const TIMEVALUE: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const text = toText(value);
    if (isError(text)) return text;
    return parseTimeText(text);
  },
};

export default TIMEVALUE;
