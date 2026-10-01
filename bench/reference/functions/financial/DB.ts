import type { FormulaFunction } from '../../core/types';
import { checkNumber, toInteger, toNumber } from '../../core/coerce';
import { optionalInteger } from '../../core/args';
import { err, isError } from '../../core/errors';
import { roundHalfAwayFromZero } from '../../helpers/rounding';

/**
 * DB(cost, salvage, life, period, [month]): fixed-declining balance depreciation for a
 * period. The rate is rounded to three decimals; month (12 by default) is the number of
 * months in the first year, in which case there is a partial last period life + 1.
 */
const DB: FormulaFunction = {
  minArgs: 4,
  maxArgs: 5,
  call(args) {
    const cost = toNumber(args[0]);
    if (isError(cost)) return cost;
    const salvage = toNumber(args[1]);
    if (isError(salvage)) return salvage;
    const life = toNumber(args[2]);
    if (isError(life)) return life;
    const period = toInteger(args[3]);
    if (isError(period)) return period;
    const month = optionalInteger(args, 4, 12);
    if (isError(month)) return month;
    if (cost < 0 || salvage < 0 || life <= 0 || period < 1 || month < 1 || month > 12) return err.num;
    const lastPeriod = month === 12 ? life : life + 1;
    if (period > lastPeriod) return err.num;
    if (cost === 0) return 0;
    const rate = roundHalfAwayFromZero(1 - Math.pow(salvage / cost, 1 / life), 3);
    let depreciation = (cost * rate * month) / 12;
    let total = depreciation;
    for (let p = 2; p <= period; p++) {
      depreciation = (cost - total) * rate;
      if (p > life) depreciation = (depreciation * (12 - month)) / 12;
      total += depreciation;
    }
    return checkNumber(depreciation);
  },
};

export default DB;
