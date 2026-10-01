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

/** IMDIV(inumber1, inumber2): the quotient of two complex numbers; #NUM! when dividing by 0. */
const IMDIV: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([aValue, bValue]) {
    const a = parseComplex(aValue);
    if (isError(a)) return a;
    const b = parseComplex(bValue);
    if (isError(b)) return b;
    const suffix = commonSuffix([a, b]);
    if (isError(suffix)) return suffix;
    const denominator = b.re * b.re + b.im * b.im;
    if (denominator === 0) return err.num;
    const re = (a.re * b.re + a.im * b.im) / denominator;
    const im = (a.im * b.re - a.re * b.im) / denominator;
    return formatComplex({ re, im, suffix });
  },
};

export default IMDIV;
