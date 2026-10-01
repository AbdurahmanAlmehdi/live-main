import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { firstError } from '../../core/errors';

/** DAYS(end_date, start_date): whole days from start_date to end_date. */
const DAYS: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call(args) {
    const dates = args.map((arg) => toNumber(arg));
    const error = firstError(...dates);
    if (error) return error;
    const [end, start] = dates as number[];
    return Math.floor(end) - Math.floor(start);
  },
};

export default DAYS;
