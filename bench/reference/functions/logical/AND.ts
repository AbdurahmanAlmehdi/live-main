import type { FormulaFunction } from '../../core/types';
import { isRange, type FormulaError, type Value } from '../../core/value';
import { toBoolean } from '../../core/coerce';
import { cellsOf } from '../../core/range';
import { err, isError } from '../../core/errors';

/**
 * The logical values in the arguments: inside arrays only booleans and numbers count
 * (text and empty cells are ignored); direct arguments are coerced to booleans.
 */
function logicalValues(args: readonly Value[]): boolean[] | FormulaError {
  const out: boolean[] = [];
  for (const arg of args) {
    if (isRange(arg)) {
      for (const cell of cellsOf(arg)) {
        if (isError(cell)) return cell;
        if (typeof cell === 'boolean') out.push(cell);
        else if (typeof cell === 'number') out.push(cell !== 0);
      }
    } else if (arg !== null) {
      const b = toBoolean(arg);
      if (isError(b)) return b;
      out.push(b);
    }
  }
  return out;
}

/** AND(logical1, ...): TRUE when every logical value is TRUE; #VALUE! when there are none. */
const AND: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const values = logicalValues(args);
    if (isError(values)) return values;
    if (values.length === 0) return err.value;
    return values.every(Boolean);
  },
};

export default AND;
