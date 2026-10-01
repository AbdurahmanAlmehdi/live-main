import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, firstError } from '../../core/errors';

/** STANDARDIZE(x, mean, standard_dev): (x - mean) / standard_dev; standard_dev must be > 0. */
const STANDARDIZE: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call(args) {
    const numbers = args.map((arg) => toNumber(arg));
    const error = firstError(...numbers);
    if (error) return error;
    const [x, mean, sd] = numbers as number[];
    if (sd <= 0) return err.num;
    return (x - mean) / sd;
  },
};

export default STANDARDIZE;
