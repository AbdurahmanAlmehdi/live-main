import type { FormulaFunction } from '../../core/types';
import { cellsOf, dimensions } from '../../core/range';
import { checkNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/**
 * SUMPRODUCT(array1, ...): multiplies corresponding cells of equally shaped arrays and
 * adds the products. Cells that are not numbers count as 0.
 */
const SUMPRODUCT: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const [height, width] = dimensions(args[0]);
    for (const arg of args) {
      const [h, w] = dimensions(arg);
      if (h !== height || w !== width) return err.value;
    }
    const arrays = args.map((arg) => cellsOf(arg));
    let total = 0;
    for (let i = 0; i < height * width; i++) {
      let product = 1;
      for (const cells of arrays) {
        const cell = cells[i];
        if (isError(cell)) return cell;
        product *= typeof cell === 'number' ? cell : 0;
      }
      total += product;
    }
    return checkNumber(total);
  },
};

export default SUMPRODUCT;
