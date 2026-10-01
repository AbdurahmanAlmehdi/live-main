import type { FormulaFunction } from '../../core/types';
import { optionalNumber } from '../../core/args';
import { err, isError } from '../../core/errors';
import { collectCashflows } from '../../helpers/cashflows';
import { solveNewton } from '../../helpers/solver';

/**
 * XIRR(values, dates, [guess]): the internal rate of return of cash flows on the given
 * dates (actual/365 from the first date), solved from guess (10% by default).
 */
const XIRR: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    const flows = collectCashflows(args[0]);
    if (isError(flows)) return flows;
    const serials = collectCashflows(args[1]);
    if (isError(serials)) return serials;
    const guess = optionalNumber(args, 2, 0.1);
    if (isError(guess)) return guess;
    if (flows.length !== serials.length) return err.num;
    if (!flows.some((v) => v > 0) || !flows.some((v) => v < 0)) return err.num;
    const dates = serials.map((serial) => Math.floor(serial));
    if (dates.some((d) => d < dates[0])) return err.num;
    const presentValue = (rate: number): number => {
      if (rate <= -1) return NaN;
      let total = 0;
      for (let i = 0; i < flows.length; i++) total += flows[i] / Math.pow(1 + rate, (dates[i] - dates[0]) / 365);
      return total;
    };
    return solveNewton(presentValue, guess);
  },
};

export default XIRR;
