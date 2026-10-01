import type { FormulaFunction } from '../../core/types';
import type { FormulaError } from '../../core/value';
import { err, isError } from '../../core/errors';
import { parseComplex, type Complex } from '../../helpers/complexParse';
import { formatComplex } from '../../helpers/complexFormat';

/** The suffix shared by the operands that have an imaginary part ("i" when none has one); #VALUE! when they mix "i" and "j". */
function commonSuffix(operands: readonly Complex[]): Complex['suffix'] | FormulaError {
  const suffixes = new Set(operands.filter((z) => z.im !== 0).map((z) => z.suffix));
  if (suffixes.size > 1) return err.value;
  return suffixes.has('j') ? 'j' : 'i';
}

/** IMSUB(inumber1, inumber2): the difference of two complex numbers. */
const IMSUB: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([aValue, bValue]) {
    const a = parseComplex(aValue);
    if (isError(a)) return a;
    const b = parseComplex(bValue);
    if (isError(b)) return b;
    const suffix = commonSuffix([a, b]);
    if (isError(suffix)) return suffix;
    return formatComplex({ re: a.re - b.re, im: a.im - b.im, suffix });
  },
};

export default IMSUB;
