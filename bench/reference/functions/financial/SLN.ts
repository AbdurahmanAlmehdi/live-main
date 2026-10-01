import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** SLN(cost, salvage, life): the straight-line depreciation of an asset for one period. */
const SLN: FormulaFunction = {
  minArgs: 3,
  maxArgs: 3,
  call([costValue, salvageValue, lifeValue]) {
    const cost = toNumber(costValue);
    if (isError(cost)) return cost;
    const salvage = toNumber(salvageValue);
    if (isError(salvage)) return salvage;
    const life = toNumber(lifeValue);
    if (isError(life)) return life;
    if (life === 0) return err.div0;
    return checkNumber((cost - salvage) / life);
  },
};

export default SLN;
