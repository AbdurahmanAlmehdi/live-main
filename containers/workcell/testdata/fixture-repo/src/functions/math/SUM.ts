import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/value';

const SUM: FormulaFunction = (args) => args.reduce<number>((acc, v) => acc + toNumber(v), 0);

export default SUM;
