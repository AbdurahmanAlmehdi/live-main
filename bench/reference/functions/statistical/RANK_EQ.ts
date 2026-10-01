import type { FormulaFunction } from '../../core/types';
import { collectNumbers, optionalNumber } from '../../core/args';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { rankOf } from '../../helpers/rank';

/** RANK.EQ(number, ref, [order]): the rank of number in ref (descending unless order is non-zero); ties share the best rank. */
const RANK_EQ: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    const n = toNumber(args[0]);
    if (isError(n)) return n;
    const numbers = collectNumbers([args[1]]);
    if (isError(numbers)) return numbers;
    const order = optionalNumber(args, 2, 0);
    if (isError(order)) return order;
    return rankOf(n, numbers, order !== 0);
  },
};

export default RANK_EQ;
