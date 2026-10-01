import type { FormulaFunction } from '../../core/types';
import { checkNumber, toInteger, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** EFFECT(nominal_rate, npery): the effective annual rate of a nominal rate compounded npery (truncated) times a year. */
const EFFECT: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([rateValue, nperyValue]) {
    const nominal = toNumber(rateValue);
    if (isError(nominal)) return nominal;
    const npery = toInteger(nperyValue);
    if (isError(npery)) return npery;
    if (nominal <= 0 || npery < 1) return err.num;
    return checkNumber(Math.pow(1 + nominal / npery, npery) - 1);
  },
};

export default EFFECT;
