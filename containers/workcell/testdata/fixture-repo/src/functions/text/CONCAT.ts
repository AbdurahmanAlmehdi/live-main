import type { FormulaFunction } from '../../core/types';
import { toText } from '../../core/value';

const CONCAT: FormulaFunction = (args) => args.map(toText).join('');

export default CONCAT;
