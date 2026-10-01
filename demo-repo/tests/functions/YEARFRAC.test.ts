// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('YEARFRAC', () => {
  it('=YEARFRAC(DATE(2020, 1, 1), DATE(2020, 7, 1))', async () => {
    expect(await evaluate('=YEARFRAC(DATE(2020, 1, 1), DATE(2020, 7, 1))')).toBeCloseTo(0.5, 9);
  });
  it('=YEARFRAC(DATE(2020, 1, 1), DATE(2020, 7, 1), 1)', async () => {
    expect(await evaluate('=YEARFRAC(DATE(2020, 1, 1), DATE(2020, 7, 1), 1)')).toBeCloseTo(0.4972677595628415, 9);
  });
  it('=YEARFRAC(DATE(2019, 3, 1), DATE(2020, 2, 15), 1)', async () => {
    expect(await evaluate('=YEARFRAC(DATE(2019, 3, 1), DATE(2020, 2, 15), 1)')).toBeCloseTo(0.9616438356164384, 9);
  });
  it('=YEARFRAC(DATE(2018, 6, 30), DATE(2021, 1, 1), 1)', async () => {
    expect(await evaluate('=YEARFRAC(DATE(2018, 6, 30), DATE(2021, 1, 1), 1)')).toBeCloseTo(2.507871321013005, 8);
  });
  it('=YEARFRAC(DATE(2020, 1, 1), DATE(2020, 7, 1), 2)', async () => {
    expect(await evaluate('=YEARFRAC(DATE(2020, 1, 1), DATE(2020, 7, 1), 2)')).toBeCloseTo(0.5055555555555555, 9);
  });
  it('=YEARFRAC(DATE(2020, 1, 1), DATE(2020, 7, 1), 3)', async () => {
    expect(await evaluate('=YEARFRAC(DATE(2020, 1, 1), DATE(2020, 7, 1), 3)')).toBeCloseTo(0.4986301369863014, 9);
  });
  it('=YEARFRAC(DATE(2020, 1, 31), DATE(2020, 3, 31), 4)', async () => {
    expect(await evaluate('=YEARFRAC(DATE(2020, 1, 31), DATE(2020, 3, 31), 4)')).toBeCloseTo(0.16666666666666666, 9);
  });
  it('=YEARFRAC(DATE(2020, 7, 1), DATE(2020, 1, 1))', async () => {
    expect(await evaluate('=YEARFRAC(DATE(2020, 7, 1), DATE(2020, 1, 1))')).toBeCloseTo(0.5, 9);
  });
  it('=YEARFRAC(43845, 44197, 5)', async () => {
    expect(await evaluate('=YEARFRAC(43845, 44197, 5)')).toMatchObject({ code: '#NUM!' });
  });
});
