import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { optionalInteger, optionalNumber } from '../../core/args';
import { err, isError } from '../../core/errors';
import { solveNewton } from '../../helpers/solver';

/**
 * The annuity equation pv·(1+r)^n + pmt·(1+r·type)·((1+r)^n − 1)/r + fv as a function of
 * r, evaluated with log1p/expm1 so that it stays accurate for rates close to zero.
 */
function annuityBalance(rate: number, nper: number, pmt: number, pv: number, fv: number, type: number): number {
  if (rate <= -1) return NaN;
  const exponent = nper * Math.log1p(rate);
  const factor = rate === 0 ? nper : Math.expm1(exponent) / rate;
  return pv * Math.exp(exponent) + pmt * (1 + rate * type) * factor + fv;
}

/** RATE(nper, pmt, pv, [fv], [type], [guess]): the interest rate per period of an annuity, solved from guess (10% by default). */
const RATE: FormulaFunction = {
  minArgs: 3,
  maxArgs: 6,
  call(args) {
    const nper = toNumber(args[0]);
    if (isError(nper)) return nper;
    const pmt = toNumber(args[1]);
    if (isError(pmt)) return pmt;
    const pv = toNumber(args[2]);
    if (isError(pv)) return pv;
    const fv = optionalNumber(args, 3, 0);
    if (isError(fv)) return fv;
    const type = optionalInteger(args, 4, 0);
    if (isError(type)) return type;
    const guess = optionalNumber(args, 5, 0.1);
    if (isError(guess)) return guess;
    if (nper <= 0) return err.num;
    const due = type === 0 ? 0 : 1;
    return solveNewton((rate) => annuityBalance(rate, nper, pmt, pv, fv, due), guess);
  },
};

export default RATE;
