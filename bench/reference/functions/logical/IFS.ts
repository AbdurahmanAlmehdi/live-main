import type { FormulaFunction } from '../../core/types';
import { toBoolean } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** IFS(test1, value1, [test2, value2], ...): the value of the first TRUE test; #N/A when none is TRUE. */
const IFS: FormulaFunction = {
  minArgs: 2,
  maxArgs: Infinity,
  call(args) {
    if (args.length % 2 !== 0) return err.value;
    for (let i = 0; i < args.length; i += 2) {
      const test = toBoolean(args[i]);
      if (isError(test)) return test;
      if (test) return args[i + 1] ?? 0;
    }
    return err.na;
  },
};

export default IFS;
