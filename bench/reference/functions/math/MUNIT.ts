import type { FormulaFunction } from '../../core/types';
import { fromRows } from '../../core/range';
import { toInteger } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** MUNIT(dimension): the identity matrix of the given size. */
const MUNIT: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const size = toInteger(value);
    if (isError(size)) return size;
    if (size < 1) return err.value;
    return fromRows(Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => (r === c ? 1 : 0))));
  },
};

export default MUNIT;
