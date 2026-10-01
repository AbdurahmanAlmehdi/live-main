import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { optionalText } from '../../core/args';
import { err, isError } from '../../core/errors';
import { formatComplex } from '../../helpers/complexFormat';

/** COMPLEX(real_num, i_num, [suffix]): the complex number real_num + i_num·i as text; suffix is "i" (default) or "j". */
const COMPLEX: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    const re = toNumber(args[0]);
    if (isError(re)) return re;
    const im = toNumber(args[1]);
    if (isError(im)) return im;
    const suffix = optionalText(args, 2, 'i');
    if (isError(suffix)) return suffix;
    if (suffix !== 'i' && suffix !== 'j' && suffix !== '') return err.value;
    return formatComplex({ re, im, suffix: suffix === 'j' ? 'j' : 'i' });
  },
};

export default COMPLEX;
