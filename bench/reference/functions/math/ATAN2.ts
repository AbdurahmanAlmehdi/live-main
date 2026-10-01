import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, firstError } from '../../core/errors';

/** ATAN2(x_num, y_num): the angle of the point (x, y), in (-pi, pi]. */
const ATAN2: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call(args) {
    const coordinates = args.map((arg) => toNumber(arg));
    const error = firstError(...coordinates);
    if (error) return error;
    const [x, y] = coordinates as number[];
    if (x === 0 && y === 0) return err.div0;
    return Math.atan2(y, x);
  },
};

export default ATAN2;
