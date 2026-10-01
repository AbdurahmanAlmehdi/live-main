import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { cellsOf } from '../../core/range';
import { isError } from '../../core/errors';

/** FVSCHEDULE(principal, schedule): principal compounded by each rate in schedule (empty cells count as 0). */
const FVSCHEDULE: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([principalValue, schedule]) {
    const principal = toNumber(principalValue);
    if (isError(principal)) return principal;
    let total = principal;
    for (const cell of cellsOf(schedule)) {
      const rate = toNumber(cell);
      if (isError(rate)) return rate;
      total *= 1 + rate;
    }
    return checkNumber(total);
  },
};

export default FVSCHEDULE;
