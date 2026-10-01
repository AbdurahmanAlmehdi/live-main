import type { FormulaFunction } from '../../core/types';
import { toRange } from '../../core/range';
import { toInteger } from '../../core/coerce';
import { optionalInteger } from '../../core/args';
import { err, isError } from '../../core/errors';

/**
 * INDEX(array, row_num, [column_num]): the cell at (row_num, column_num), 1-based. A
 * single-row array may be indexed by column with one number. #REF! when out of range.
 */
const INDEX: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    if (isError(args[0])) return args[0];
    const range = toRange(args[0]);
    let row = toInteger(args[1]);
    if (isError(row)) return row;
    let col = optionalInteger(args, 2, 1);
    if (isError(col)) return col;
    if (row < 0 || col < 0) return err.value;
    if (args.length < 3 && range.height === 1 && range.width > 1) {
      col = row;
      row = 1;
    }
    if (row === 0 || col === 0 || row > range.height || col > range.width) return err.ref;
    return range.at(row - 1, col - 1);
  },
};

export default INDEX;
