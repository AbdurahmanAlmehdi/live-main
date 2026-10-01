import type { FormulaFunction } from '../../core/types';
import type { FormulaError, Value } from '../../core/value';
import { flattenArgs } from '../../core/args';
import { err, isError } from '../../core/errors';
import { parseComplex, type Complex } from '../../helpers/complexParse';
import { formatComplex } from '../../helpers/complexFormat';

/** The suffix shared by the operands that have an imaginary part ("i" when none has one); #VALUE! when they mix "i" and "j". */
function commonSuffix(operands: readonly Complex[]): Complex['suffix'] | FormulaError {
  const suffixes = new Set(operands.filter((z) => z.im !== 0).map((z) => z.suffix));
  if (suffixes.size > 1) return err.value;
  return suffixes.has('j') ? 'j' : 'i';
}

/** IMSUM(inumber1, [inumber2], ...): the sum of complex numbers (arrays contribute every element). */
const IMSUM: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args: Value[]) {
    const operands: Complex[] = [];
    for (const cell of flattenArgs(args)) {
      const z = parseComplex(cell);
      if (isError(z)) return z;
      operands.push(z);
    }
    const suffix = commonSuffix(operands);
    if (isError(suffix)) return suffix;
    let re = 0;
    let im = 0;
    for (const z of operands) {
      re += z.re;
      im += z.im;
    }
    return formatComplex({ re, im, suffix });
  },
};

export default IMSUM;
