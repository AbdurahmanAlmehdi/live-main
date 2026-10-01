import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { collectNumbers } from '../../core/args';
import { err, isError } from '../../core/errors';
import { netPresentValue } from '../../helpers/cashflows';

/**
 * NPV(rate, value1, [value2], ...): the net present value of cash flows at the end of
 * periods 1, 2, ... (numbers inside arrays only; direct numeric text and booleans count).
 */
const NPV: FormulaFunction = {
  minArgs: 2,
  maxArgs: Infinity,
  call(args) {
    const rate = toNumber(args[0]);
    if (isError(rate)) return rate;
    const flows = collectNumbers(args.slice(1));
    if (isError(flows)) return flows;
    if (rate === -1) return err.div0;
    return checkNumber(netPresentValue(rate, flows));
  },
};

export default NPV;
