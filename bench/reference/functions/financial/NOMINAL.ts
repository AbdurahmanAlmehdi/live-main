import type { FormulaFunction } from '../../core/types';
import { checkNumber, toInteger, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** NOMINAL(effect_rate, npery): the nominal annual rate that compounds npery (truncated) times a year to effect_rate. */
const NOMINAL: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([rateValue, nperyValue]) {
    const effective = toNumber(rateValue);
    if (isError(effective)) return effective;
    const npery = toInteger(nperyValue);
    if (isError(npery)) return npery;
    if (effective <= 0 || npery < 1) return err.num;
    return checkNumber(npery * (Math.pow(1 + effective, 1 / npery) - 1));
  },
};

export default NOMINAL;
