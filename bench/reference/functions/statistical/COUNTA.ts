import type { FormulaFunction } from '../../core/types';
import { flattenArgs } from '../../core/args';

/** COUNTA(value1, ...): how many values are not empty (empty text and errors count). */
const COUNTA: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    return flattenArgs(args).filter((cell) => cell !== null).length;
  },
};

export default COUNTA;
