import type { FormulaFunction } from '../../core/types';
import { ERROR_CODES } from '../../core/value';
import { err, isError } from '../../core/errors';

/** ERROR.TYPE(error_val): 1 #NULL!, 2 #DIV/0!, 3 #VALUE!, 4 #REF!, 5 #NAME?, 6 #NUM!, 7 #N/A; #N/A for non-errors. */
const ERROR_TYPE: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    if (!isError(value)) return err.na;
    return ERROR_CODES.indexOf(value.code) + 1;
  },
};

export default ERROR_TYPE;
