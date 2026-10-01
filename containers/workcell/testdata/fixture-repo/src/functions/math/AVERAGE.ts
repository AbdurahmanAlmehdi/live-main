import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/value';

const AVERAGE: FormulaFunction = (args) => {
  if (args.length === 0) return '#DIV/0!';
  return args.reduce<number>((acc, v) => acc + toNumber(v), 0) / args.length;
};

export default AVERAGE;
