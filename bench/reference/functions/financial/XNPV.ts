import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { collectCashflows } from '../../helpers/cashflows';

/**
 * XNPV(rate, values, dates): the net present value of cash flows on the given dates,
 * discounted from the first date on an actual/365 basis (dates are truncated).
 */
const XNPV: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call([rateValue, values, datesValue]) {
    const rate = toNumber(rateValue);
    if (isError(rate)) return rate;
    const flows = collectCashflows(values);
    if (isError(flows)) return flows;
    const serials = collectCashflows(datesValue);
    if (isError(serials)) return serials;
    if (flows.length === 0 || flows.length !== serials.length || rate <= -1) return err.num;
    const dates = serials.map((serial) => Math.floor(serial));
    if (dates.some((d) => d < dates[0])) return err.num;
    let total = 0;
    for (let i = 0; i < flows.length; i++) total += flows[i] / Math.pow(1 + rate, (dates[i] - dates[0]) / 365);
    return checkNumber(total);
  },
};

export default XNPV;
