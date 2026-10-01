import type { FormulaFunction } from '../../core/types';
import { optionalNumber } from '../../core/args';
import { err, isError } from '../../core/errors';
import { collectCashflows, netPresentValue } from '../../helpers/cashflows';
import { solveNewton } from '../../helpers/solver';

/** IRR(values, [guess]): the internal rate of return of periodic cash flows, solved from guess (10% by default). */
const IRR: FormulaFunction = {
  minArgs: 1,
  maxArgs: 2,
  call(args) {
    const flows = collectCashflows(args[0]);
    if (isError(flows)) return flows;
    const guess = optionalNumber(args, 1, 0.1);
    if (isError(guess)) return guess;
    if (!flows.some((v) => v > 0) || !flows.some((v) => v < 0)) return err.num;
    // Discount from period 0 (the first flow is not discounted), which keeps Newton stable for low rates.
    return solveNewton((rate) => (rate <= -1 ? NaN : (1 + rate) * netPresentValue(rate, flows)), guess);
  },
};

export default IRR;
