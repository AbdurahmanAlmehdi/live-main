import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { collectCashflows, netPresentValue } from '../../helpers/cashflows';

/**
 * MIRR(values, finance_rate, reinvest_rate): the modified internal rate of return, with
 * outflows financed at finance_rate and inflows reinvested at reinvest_rate.
 */
const MIRR: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call([values, financeValue, reinvestValue]) {
    const flows = collectCashflows(values);
    if (isError(flows)) return flows;
    const financeRate = toNumber(financeValue);
    if (isError(financeRate)) return financeRate;
    const reinvestRate = toNumber(reinvestValue);
    if (isError(reinvestRate)) return reinvestRate;
    const inflows = flows.map((v) => Math.max(v, 0));
    const outflows = flows.map((v) => Math.min(v, 0));
    if (!inflows.some((v) => v > 0) || !outflows.some((v) => v < 0)) return err.div0;
    const n = flows.length;
    const futureInflows = netPresentValue(reinvestRate, inflows) * Math.pow(1 + reinvestRate, n);
    const presentOutflows = netPresentValue(financeRate, outflows) * (1 + financeRate);
    return checkNumber(Math.pow(-futureInflows / presentOutflows, 1 / (n - 1)) - 1);
  },
};

export default MIRR;
