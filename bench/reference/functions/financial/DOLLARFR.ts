import type { FormulaFunction } from '../../core/types';
import { checkNumber, toInteger, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/**
 * DOLLARFR(decimal_dollar, fraction): writes a decimal price with its decimals as a
 * numerator over fraction (1.125 with 16 gives 1.02, i.e. 1 + 2/16). fraction is truncated.
 */
const DOLLARFR: FormulaFunction = {
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
    return checkNumber(whole + ((dollar - whole) * fraction) / scale);
  },
};

export default DOLLARFR;
