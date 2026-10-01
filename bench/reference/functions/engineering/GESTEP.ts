import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { optionalNumber } from '../../core/args';
import { isError } from '../../core/errors';

/** GESTEP(number, [step]): 1 when number >= step (step defaults to 0), 0 otherwise. */
const GESTEP: FormulaFunction = {
  minArgs: 1,
  maxArgs: 2,
  call(args) {
    const n = toNumber(args[0]);
    if (isError(n)) return n;
    const step = optionalNumber(args, 1, 0);
    if (isError(step)) return step;
    return n >= step ? 1 : 0;
  },
};

export default GESTEP;
