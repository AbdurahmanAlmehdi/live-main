import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { err, firstError } from '../../core/errors';

/** MOD(number, divisor): the remainder of a division, with the sign of the divisor. */
const MOD: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call(args) {
    const numbers = args.map((arg) => toNumber(arg));
    const error = firstError(...numbers);
    if (error) return error;
    const [n, d] = numbers as number[];
    if (d === 0) return err.div0;
    return checkNumber(n - d * Math.floor(n / d));
  },
};

export default MOD;
