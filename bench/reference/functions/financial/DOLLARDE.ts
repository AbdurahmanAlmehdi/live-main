import type { FormulaFunction } from '../../core/types';
import { checkNumber, toInteger, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/**
 * DOLLARDE(fractional_dollar, fraction): converts a price whose decimals are a numerator
 * over fraction (1.02 with 16 means 1 + 2/16) to a decimal number. fraction is truncated.
 */
const DOLLARDE: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([dollarValue, fractionValue]) {
    const dollar = toNumber(dollarValue);
    if (isError(dollar)) return dollar;
    const fraction = toInteger(fractionValue);
    if (isError(fraction)) return fraction;
    if (fraction < 0) return err.num;
    if (fraction === 0) return err.div0;
    const whole = Math.trunc(dollar);
    const scale = Math.pow(10, Math.ceil(Math.log10(fraction)));
    return checkNumber(whole + ((dollar - whole) * scale) / fraction);
  },
};

export default DOLLARDE;
