// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('YEAR', () => {
  it('=YEAR(43845)', async () => {
    expect(await evaluate('=YEAR(43845)')).toBeCloseTo(2020, 5);
  });
  it('=YEAR(44197)', async () => {
    expect(await evaluate('=YEAR(44197)')).toBeCloseTo(2021, 5);
  });
  it('=YEAR(DATE(1999, 12, 31))', async () => {
    expect(await evaluate('=YEAR(DATE(1999, 12, 31))')).toBeCloseTo(1999, 5);
  });
  it('=YEAR(1)', async () => {
    expect(await evaluate('=YEAR(1)')).toBeCloseTo(1900, 5);
  });
  it('=YEAR(-1)', async () => {
    expect(await evaluate('=YEAR(-1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=YEAR("x")', async () => {
    expect(await evaluate('=YEAR("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
