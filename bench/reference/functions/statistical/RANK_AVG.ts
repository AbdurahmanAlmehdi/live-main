import type { FormulaFunction } from '../../core/types';
import { collectNumbers, optionalNumber } from '../../core/args';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { rankOf } from '../../helpers/rank';

/** RANK.AVG(number, ref, [order]): the rank of number in ref; tied numbers get the average of their ranks. */
const RANK_AVG: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    const n = toNumber(args[0]);
    if (isError(n)) return n;
    const numbers = collectNumbers([args[1]]);
    if (isError(numbers)) return numbers;
    const order = optionalNumber(args, 2, 0);
    if (isError(order)) return order;
    return rankOf(n, numbers, order !== 0, { ties: 'average' });
  },
};

export default RANK_AVG;
