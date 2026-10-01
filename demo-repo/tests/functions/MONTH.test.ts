// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('MONTH', () => {
  it('=MONTH(43845)', async () => {
    expect(await evaluate('=MONTH(43845)')).toBeCloseTo(1, 9);
  });
  it('=MONTH(43890)', async () => {
    expect(await evaluate('=MONTH(43890)')).toBeCloseTo(2, 8);
  });
  it('=MONTH(DATE(2021, 12, 31))', async () => {
    expect(await evaluate('=MONTH(DATE(2021, 12, 31))')).toBeCloseTo(12, 7);
  });
  it('=MONTH(1)', async () => {
    expect(await evaluate('=MONTH(1)')).toBeCloseTo(1, 9);
  });
  it('=MONTH(-1)', async () => {
    expect(await evaluate('=MONTH(-1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=MONTH("x")', async () => {
    expect(await evaluate('=MONTH("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
