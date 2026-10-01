import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** SYD(cost, salvage, life, per): the sum-of-years' digits depreciation of an asset for period per (1..life). */
const SYD: FormulaFunction = {
  minArgs: 4,
  maxArgs: 4,
  call([costValue, salvageValue, lifeValue, perValue]) {
    const cost = toNumber(costValue);
    if (isError(cost)) return cost;
    const salvage = toNumber(salvageValue);
    if (isError(salvage)) return salvage;
    const life = toNumber(lifeValue);
    if (isError(life)) return life;
    const per = toNumber(perValue);
    if (isError(per)) return per;
    if (life <= 0 || per <= 0 || per > life) return err.num;
    return checkNumber(((cost - salvage) * (life - per + 1) * 2) / (life * (life + 1)));
  },
};

export default SYD;
