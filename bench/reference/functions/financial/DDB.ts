import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { optionalNumber } from '../../core/args';
import { err, isError } from '../../core/errors';

/**
 * DDB(cost, salvage, life, period, [factor]): declining balance depreciation for a period,
 * at factor / life per period (factor 2 by default), never going below salvage.
 */
const DDB: FormulaFunction = {
  minArgs: 4,
  maxArgs: 5,
  call(args) {
    const cost = toNumber(args[0]);
    if (isError(cost)) return cost;
    const salvage = toNumber(args[1]);
    if (isError(salvage)) return salvage;
    const life = toNumber(args[2]);
    if (isError(life)) return life;
    const period = toNumber(args[3]);
    if (isError(period)) return period;
    const factor = optionalNumber(args, 4, 2);
    if (isError(factor)) return factor;
    if (cost < 0 || salvage < 0 || life <= 0 || period <= 0 || factor <= 0 || period > life) return err.num;
    const rate = Math.min(factor / life, 1);
    let before: number;
    if (rate === 1) before = period === 1 ? cost : 0;
    else before = cost * Math.pow(1 - rate, period - 1);
    const after = Math.max(cost * Math.pow(1 - rate, period), salvage);
    return checkNumber(Math.max(before - after, 0));
  },
};

export default DDB;
