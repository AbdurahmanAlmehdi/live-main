// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('WORKDAY', () => {
  it('=WORKDAY(DATE(2020, 1, 15), 10)', async () => {
    expect(await evaluate('=WORKDAY(DATE(2020, 1, 15), 10)')).toBeCloseTo(43859, 4);
  });
  it('=WORKDAY(DATE(2020, 1, 15), -10)', async () => {
    expect(await evaluate('=WORKDAY(DATE(2020, 1, 15), -10)')).toBeCloseTo(43831, 4);
  });
  it('=WORKDAY(DATE(2020, 1, 15), 10, {43850, 43851})', async () => {
    expect(await evaluate('=WORKDAY(DATE(2020, 1, 15), 10, {43850, 43851})')).toBeCloseTo(43861, 4);
  });
  it('=WORKDAY(DATE(2020, 1, 18), 1)', async () => {
    expect(await evaluate('=WORKDAY(DATE(2020, 1, 18), 1)')).toBeCloseTo(43850, 4);
  });
  it('=WORKDAY(DATE(2020, 1, 15), 0)', async () => {
    expect(await evaluate('=WORKDAY(DATE(2020, 1, 15), 0)')).toBeCloseTo(43845, 4);
  });
  it('=WORKDAY("x", 1)', async () => {
    expect(await evaluate('=WORKDAY("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
