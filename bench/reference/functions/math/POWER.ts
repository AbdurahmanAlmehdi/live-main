import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** POWER(number, power): number raised to a power. */
const POWER: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([baseValue, exponentValue]) {
    const base = toNumber(baseValue);
    if (isError(base)) return base;
    const exponent = toNumber(exponentValue);
    if (isError(exponent)) return exponent;
    if (base === 0 && exponent === 0) return err.num;
    if (base === 0 && exponent < 0) return err.div0;
    return checkNumber(Math.pow(base, exponent));
  },
};

export default POWER;
