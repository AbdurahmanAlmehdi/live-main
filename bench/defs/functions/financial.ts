import type { FnSpec } from '../types.ts';

const f = (name: string, signature: string, summary: string, cases: FnSpec['cases']): FnSpec => ({ name, category: 'financial', signature, summary, cases });

const XDATES = '{39448, 39508, 39751, 39859, 39904}';
const XFLOWS = '{-10000, 2750, 4250, 3250, 2750}';

export const financial: FnSpec[] = [
  f('FV', 'FV(rate, nper, pmt, [pv], [type])', 'Returns the future value of an investment with periodic constant payments and a constant interest rate.', [
    '=FV(0.06/12, 10, -200, -500, 1)', '=FV(0.12/12, 12, -1000)', '=FV(0.11/12, 35, -2000, , 1)', '=FV(0, 10, -100, -1000)',
    '=FV(0.05, 10, 0, -1000)', '=FV(-0.02, 5, -100, 1000)', '=FV(0.1, 2.5, -100)', { f: '=FV("1%", 12, -100)', expect: 1268.2503013196979, why: 'percent text is a number (0.01); formula.js rejects it' }, '=FV("x", 12, -100)',
  ]),
  f('PV', 'PV(rate, nper, pmt, [fv], [type])', 'Returns the present value of an investment: the total amount that a series of future payments is worth now.', [
    '=PV(0.08/12, 12*20, 500, , 0)', '=PV(0.1, 5, -100, -1000, 1)', '=PV(0, 10, -100)', '=PV(0.05, 10, 0, 1000)',
    '=PV(0.07, 3.5, -250)', '=PV(0.05, "10", -100)', '=PV("x", 10, 100)',
  ]),
  f('PMT', 'PMT(rate, nper, pv, [fv], [type])', 'Returns the periodic payment for a loan or investment with constant payments and a constant interest rate.', [
    '=PMT(0.08/12, 10, 10000)', '=PMT(0.08/12, 10, 10000, 0, 1)', '=PMT(0.06/12, 18*12, 0, 50000)', '=PMT(0, 12, 1200)',
    '=PMT(0.05, 10, -1000, 500, 1)', '=PMT(0.1, 0, 1000)', '=PMT("x", 10, 1000)',
  ]),
  f('NPER', 'NPER(rate, pmt, pv, [fv], [type])', 'Returns the number of periods for an investment with periodic constant payments and a constant interest rate.', [
    '=NPER(0.12/12, -100, -1000, 10000, 1)', '=NPER(0.12/12, -100, -1000, 10000)', '=NPER(0.12/12, -100, -1000)', '=NPER(0, -100, 1000)',
    '=NPER(0.05, -500, 3000, 0, 1)', '=NPER(0.1, 100, 1000)', '=NPER(0.1, -100, 2000)', '=NPER("x", -100, 1000)',
  ]),
  f('RATE', 'RATE(nper, pmt, pv, [fv], [type], [guess])', 'Returns the interest rate per period of an annuity, found iteratively from guess (10% by default).', [
    '=RATE(4*12, -200, 8000)', '=RATE(4*12, -200, 8000)*12', '=RATE(10, -100, 700, 0, 1)', '=RATE(5, 0, -1000, 1500)',
    '=RATE(36, -300, 9000, 0, 0, 0.01)', '=RATE(12, -100, 1200)', '=RATE(0, -100, 1000)', '=RATE(10, 100, 1000)', '=RATE("x", -100, 1000)',
  ]),
  f('IPMT', 'IPMT(rate, per, nper, pv, [fv], [type])', 'Returns the interest portion of the payment for a given period of a loan or investment.', [
    '=IPMT(0.1/12, 1, 3*12, 8000)', '=IPMT(0.1, 3, 3, 8000)', '=IPMT(0.1, 1, 3, 8000, 0, 1)', '=IPMT(0.1, 2, 3, 8000, 0, 1)',
    '=IPMT(0.05, 4, 10, -5000, 1000)', '=IPMT(0, 2, 5, 1000)', { f: '=IPMT(0.1, 0, 3, 8000)', expect: { error: '#NUM!' }, why: 'per must be between 1 and nper' }, { f: '=IPMT(0.1, 4, 3, 8000)', expect: { error: '#NUM!' }, why: 'per must be between 1 and nper' }, '=IPMT("x", 1, 3, 8000)',
  ]),
  f('PPMT', 'PPMT(rate, per, nper, pv, [fv], [type])', 'Returns the principal portion of the payment for a given period of a loan or investment.', [
    '=PPMT(0.1/12, 1, 2*12, 2000)', '=PPMT(0.08, 10, 10, 200000)', '=PPMT(0.1, 1, 3, 8000, 0, 1)', '=PPMT(0.05, 3, 10, -5000, 1000, 1)',
    '=PPMT(0, 2, 4, 1000)', { f: '=PPMT(0.1, 5, 3, 8000)', expect: { error: '#NUM!' }, why: 'per must be between 1 and nper' }, '=PPMT("x", 1, 3, 8000)',
  ]),
  f('CUMIPMT', 'CUMIPMT(rate, nper, pv, start_period, end_period, type)', 'Returns the cumulative interest paid on a loan between start_period and end_period.', [
    '=CUMIPMT(0.09/12, 30*12, 125000, 13, 24, 0)', '=CUMIPMT(0.09/12, 30*12, 125000, 1, 1, 0)', '=CUMIPMT(0.1, 5, 1000, 1, 5, 1)', '=CUMIPMT(0.05, 10, 5000, 3, 7, 0)',
    '=CUMIPMT(0, 10, 1000, 1, 2, 0)', '=CUMIPMT(0.1, 10, -1000, 1, 2, 0)', '=CUMIPMT(0.1, 10, 1000, 3, 2, 0)', { f: '=CUMIPMT(0.1, 10, 1000, 1, 11, 0)', expect: { error: '#NUM!' }, why: 'end_period cannot exceed nper' },
    '=CUMIPMT(0.1, 10, 1000, 1, 2, 2)', '=CUMIPMT("x", 10, 1000, 1, 2, 0)',
  ]),
  f('CUMPRINC', 'CUMPRINC(rate, nper, pv, start_period, end_period, type)', 'Returns the cumulative principal paid on a loan between start_period and end_period.', [
    '=CUMPRINC(0.09/12, 30*12, 125000, 13, 24, 0)', '=CUMPRINC(0.09/12, 30*12, 125000, 1, 1, 0)', '=CUMPRINC(0.1, 5, 1000, 1, 5, 1)', '=CUMPRINC(0.05, 10, 5000, 3, 7, 0)',
    '=CUMPRINC(0, 10, 1000, 1, 2, 0)', '=CUMPRINC(0.1, 10, 1000, 0, 2, 0)', '=CUMPRINC(0.1, 10, 1000, 1, 2, -1)', '=CUMPRINC("x", 10, 1000, 1, 2, 0)',
  ]),
  f('NPV', 'NPV(rate, value1, [value2], ...)', 'Returns the net present value of cash flows at the end of periods 1, 2, ... discounted at rate.', [
    '=NPV(0.1, -10000, 3000, 4200, 6800)', '=NPV(0.08, {8000, 9200, 10000, 12000, 14500}) - 40000', '=NPV(0.08, {8000, 9200, 10000, 12000, 14500}, -9000)', '=NPV(0, 1, 2, 3)',
    { f: '=NPV(0.05, {100, "x", TRUE, 200})', expect: 276.6439909297052, why: 'text and booleans inside arrays are ignored' }, '=NPV(0.05, "100", 200)', '=NPV(0.1, 100, #N/A)', '=NPV("x", 100)',
  ]),
  f('IRR', 'IRR(values, [guess])', 'Returns the internal rate of return of a series of periodic cash flows, found iteratively from guess (10% by default).', [
    '=IRR({-70000, 12000, 15000, 18000, 21000})', '=IRR({-70000, 12000, 15000, 18000, 21000, 26000})', '=IRR({-70000, 12000, 15000}, -0.1)', '=IRR({-100, 110})',
    '=IRR({-1000, 100, 100, 100, 1200}, 0.05)', { f: '=IRR({-100, "x", 50, 60})', expect: 0.0639410298049854, why: 'text inside the values array is ignored' }, '=IRR({100, 200})', '=IRR({-100, -200})',
  ]),
  f('MIRR', 'MIRR(values, finance_rate, reinvest_rate)', 'Returns the modified internal rate of return of periodic cash flows, financing outflows at finance_rate and reinvesting inflows at reinvest_rate.', [
    '=MIRR({-120000, 39000, 30000, 21000, 37000, 46000}, 0.1, 0.12)', '=MIRR({-120000, 39000, 30000, 21000}, 0.1, 0.12)', '=MIRR({-120000, 39000, 30000, 21000, 37000, 46000}, 0.1, 0.14)',
    { f: '=MIRR({-100, 50, "a", 60}, 0.05, 0.08)', expect: 0.06770782520313112, why: 'text inside the values array is ignored' },
    { f: '=MIRR({100, 200}, 0.1, 0.1)', expect: { error: '#DIV/0!' }, why: 'Excel needs at least one positive and one negative flow, else #DIV/0!' },
    { f: '=MIRR({-100, -200}, 0.1, 0.1)', expect: { error: '#DIV/0!' }, why: 'Excel needs at least one positive and one negative flow, else #DIV/0!' }, '=MIRR({-100, 50, 60}, "x", 0.1)',
  ]),
  f('XNPV', 'XNPV(rate, values, dates)', 'Returns the net present value of cash flows on arbitrary dates, discounted on an actual/365 basis from the first date.', [
    `=XNPV(0.09, ${XFLOWS}, ${XDATES})`, '=XNPV(0, {-100, 50, 60}, {40000, 40100, 40200})', '=XNPV(0.1, {-1000, 1100}, {40000, 40365})', '=XNPV(0.05, {-1000, 300, 800}, {40000, 40180, 40500})',
    { f: '=XNPV(0.1, {-100, 50}, {40000, 39000})', expect: { error: '#NUM!' }, why: 'a date before the first date is #NUM!' }, '=XNPV(0.1, {-100, 50, 60}, {40000, 40100})', '=XNPV("x", {-100, 50}, {40000, 40100})',
  ]),
  f('XIRR', 'XIRR(values, dates, [guess])', 'Returns the internal rate of return of cash flows on arbitrary dates, found iteratively from guess (10% by default).', [
    `=XIRR(${XFLOWS}, ${XDATES}, 0.1)`, `=XIRR(${XFLOWS}, ${XDATES})`, '=XIRR({-1000, 1100}, {40000, 40365})', '=XIRR({-1000, 500, 300, 400}, {40000, 40200, 40400, 40800})',
    '=XIRR({1000, 1100}, {40000, 40365})', { f: '=XIRR({-1000, 1100}, {40000, 39000})', expect: { error: '#NUM!' }, why: 'a date before the first date is #NUM!' }, '=XIRR({-1000, 1100, 5}, {40000, 40365})',
  ]),
  f('EFFECT', 'EFFECT(nominal_rate, npery)', 'Returns the effective annual interest rate for a nominal rate compounded npery times a year (npery is truncated).', [
    '=EFFECT(0.0525, 4)', '=EFFECT(0.1, 12)', '=EFFECT(0.1, 1)', '=EFFECT(0.1, 4.9)', '=EFFECT(0, 4)', '=EFFECT(0.1, 0.5)', '=EFFECT("x", 4)',
  ]),
  f('NOMINAL', 'NOMINAL(effect_rate, npery)', 'Returns the nominal annual interest rate for an effective rate compounded npery times a year (npery is truncated).', [
    '=NOMINAL(0.053543, 4)', '=NOMINAL(0.1, 12)', '=NOMINAL(0.1, 1)', '=NOMINAL(0.1, 4.9)', '=NOMINAL(0, 4)', '=NOMINAL(0.1, 0.5)', '=NOMINAL("x", 4)',
  ]),
  f('SLN', 'SLN(cost, salvage, life)', 'Returns the straight-line depreciation of an asset for one period.', [
    '=SLN(30000, 7500, 10)', '=SLN(10000, 1000, 2.5)', '=SLN(1000, 2000, 5)', { f: '=SLN(1000, 100, 0)', expect: { error: '#DIV/0!' }, why: 'life 0 divides by zero' }, '=SLN("x", 1, 2)',
  ]),
  f('SYD', 'SYD(cost, salvage, life, per)', 'Returns the sum-of-years\' digits depreciation of an asset for a given period.', [
    '=SYD(30000, 7500, 10, 1)', '=SYD(30000, 7500, 10, 10)', '=SYD(1000, 100, 5, 3)', '=SYD(1000, 100, 5, 0)', '=SYD(1000, 100, 5, 6)', '=SYD(1000, 100, 0, 1)', '=SYD("x", 100, 5, 1)',
  ]),
  f('DB', 'DB(cost, salvage, life, period, [month])', 'Returns the fixed-declining balance depreciation of an asset for a period; month is the number of months in the first year (12 by default).', [
    '=DB(1000000, 100000, 6, 1, 7)', '=DB(1000000, 100000, 6, 2, 7)', { f: '=DB(1000000, 100000, 6, 7, 7)', expect: 15845.098473848071, why: 'with a partial first year there is a last period life + 1 (Excel documentation example)' }, '=DB(10000, 1000, 5, 3)',
    '=DB(1000000, 100000, 6, 7)', { f: '=DB(1000, 100, 5, 0)', expect: { error: '#NUM!' }, why: 'period must be >= 1' }, '=DB(1000, 100, 5, 1, 13)', '=DB(-1000, 100, 5, 1)', '=DB("x", 100, 5, 1)',
  ]),
  f('DDB', 'DDB(cost, salvage, life, period, [factor])', 'Returns the declining balance depreciation of an asset for a period (double-declining with factor 2 by default).', [
    '=DDB(2400, 300, 10*365, 1)', '=DDB(2400, 300, 10*12, 1, 2)', '=DDB(2400, 300, 10, 1, 2)', '=DDB(2400, 300, 10, 2, 1.5)', '=DDB(2400, 300, 10, 10)',
    '=DDB(1000, 100, 2, 1, 3)', { f: '=DDB(1000, 100, 5, 0)', expect: { error: '#NUM!' }, why: 'period must be > 0' }, '=DDB(1000, 100, 5, 6)', '=DDB(1000, 100, 5, 1, 0)', '=DDB("x", 100, 5, 1)',
  ]),
  f('PDURATION', 'PDURATION(rate, pv, fv)', 'Returns the number of periods an investment needs to grow from pv to fv at rate per period.', [
    '=PDURATION(0.025, 2000, 2200)', '=PDURATION(0.025/12, 1000, 1200)', '=PDURATION(0.1, 100, 50)', '=PDURATION(0, 100, 200)', '=PDURATION(0.1, -100, 200)', '=PDURATION("x", 100, 200)',
  ]),
  f('RRI', 'RRI(nper, pv, fv)', 'Returns the equivalent interest rate per period for the growth of an investment from pv to fv over nper periods.', [
    '=RRI(96, 10000, 11000)', '=RRI(10, 100, 200)', '=RRI(2, 100, 50)', '=RRI(0, 100, 200)', '=RRI(10, 0, 100)', '=RRI("x", 100, 200)',
  ]),
  f('FVSCHEDULE', 'FVSCHEDULE(principal, schedule)', 'Returns the future value of a principal after applying a series of compound interest rates.', [
    '=FVSCHEDULE(1, {0.09, 0.11, 0.1})', '=FVSCHEDULE(1000, {0.05; 0.05; 0.05})', '=FVSCHEDULE(100, 0.1)', '=FVSCHEDULE(100, {0.1, -0.2})', '=FVSCHEDULE(100, {0.1, "x"})', '=FVSCHEDULE("x", {0.1})',
  ]),
  f('DOLLARDE', 'DOLLARDE(fractional_dollar, fraction)', 'Converts a price written as an integer part and a fraction (e.g. 1.02 meaning 1 2/16) to a decimal number (fraction is truncated).', [
    '=DOLLARDE(1.02, 16)', '=DOLLARDE(1.1, 32)', '=DOLLARDE(-1.02, 16)', '=DOLLARDE(1.1, 8)', '=DOLLARDE(1.5, 10)', '=DOLLARDE(1.02, 16.9)',
    '=DOLLARDE(1.02, 0)', '=DOLLARDE(1.02, -1)', '=DOLLARDE("x", 16)',
  ]),
  f('DOLLARFR', 'DOLLARFR(decimal_dollar, fraction)', 'Converts a decimal price to the integer-and-fraction notation (e.g. 1.125 with fraction 16 gives 1.02; fraction is truncated).', [
    '=DOLLARFR(1.125, 16)', '=DOLLARFR(1.125, 32)', '=DOLLARFR(-1.125, 16)', '=DOLLARFR(2.5, 4)', '=DOLLARFR(1.125, 16.9)',
    '=DOLLARFR(1.125, 0)', '=DOLLARFR(1.125, -1)', '=DOLLARFR("x", 16)',
  ]),
  f('ISPMT', 'ISPMT(rate, per, nper, pv)', 'Returns the interest paid in period per (counted from 0) of a loan with even principal payments.', [
    '=ISPMT(0.1/12, 1, 3*12, 8000000)', '=ISPMT(0.1, 1, 3, 8000000)', '=ISPMT(0.1, 0, 3, 1000)', '=ISPMT(0.1, 3, 3, 1000)', { f: '=ISPMT(0.1, 1, 0, 1000)', expect: { error: '#DIV/0!' }, why: 'nper 0 divides by zero' }, '=ISPMT("x", 1, 3, 1000)',
  ]),
];
