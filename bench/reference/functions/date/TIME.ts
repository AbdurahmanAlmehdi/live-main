import type { FormulaFunction } from '../../core/types';
import { toInteger } from '../../core/coerce';
import { firstError } from '../../core/errors';
import { serialFromTime } from '../../helpers/timeOfDay';

/** TIME(hour, minute, second): the fraction of a day for a time (components truncated, overflow rolls over). */
const TIME: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call(args) {
    const parts = args.map((arg) => toInteger(arg));
    const error = firstError(...parts);
    if (error) return error;
    const [hour, minute, second] = parts as number[];
    return serialFromTime(hour, minute, second);
  },
};

export default TIME;
