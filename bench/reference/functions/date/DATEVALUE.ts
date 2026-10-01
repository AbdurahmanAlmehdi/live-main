import type { FormulaFunction } from '../../core/types';
import { err, isError } from '../../core/errors';
import { parseDateText } from '../../helpers/dateParse';

/** DATEVALUE(date_text): the serial number of a date written as text. */
const DATEVALUE: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    if (isError(value)) return value;
    if (typeof value !== 'string') return err.value;
    return parseDateText(value);
  },
};

export default DATEVALUE;
