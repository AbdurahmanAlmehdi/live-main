import type { FormulaFunction } from '../../core/types';
import { toText } from '../../core/coerce';
import { optionalText } from '../../core/args';
import { err, isError } from '../../core/errors';

/**
 * NUMBERVALUE(text, [decimal_separator], [group_separator]): reads a number written with
 * the given separators ("." and "," by default). Spaces are ignored, group separators are
 * dropped anywhere before the decimal separator, and trailing "%" signs divide by 100.
 */
const NUMBERVALUE: FormulaFunction = {
  minArgs: 1,
  maxArgs: 3,
  call(args) {
    const text = toText(args[0]);
    if (isError(text)) return text;
    const decimal = optionalText(args, 1, '.');
    if (isError(decimal)) return decimal;
    const group = optionalText(args, 2, ',');
    if (isError(group)) return group;
    const decimalSep = decimal[0] ?? '';
    const groupSep = group[0] ?? '';
    if (decimalSep === '' || decimalSep === groupSep) return err.value;
    let s = text.replace(/\s+/g, '');
    let percents = 0;
    while (s.endsWith('%')) {
      s = s.slice(0, -1);
      percents++;
    }
    if (s === '') return 0;
    const [whole, fraction, extra] = s.split(decimalSep);
    if (extra !== undefined || (fraction !== undefined && groupSep !== '' && fraction.includes(groupSep))) return err.value;
    const digits = (groupSep === '' ? whole : whole.split(groupSep).join('')) + (fraction === undefined ? '' : `.${fraction}`);
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(digits)) return err.value;
    return Number(digits) / Math.pow(100, percents);
  },
};

export default NUMBERVALUE;
