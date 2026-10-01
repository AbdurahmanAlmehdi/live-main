// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DAYS', () => {
  it('=DAYS(44197, 43845)', async () => {
    expect(await evaluate('=DAYS(44197, 43845)')).toBeCloseTo(352, 6);
  });
  it('=DAYS(43845, 44197)', async () => {
    expect(await evaluate('=DAYS(43845, 44197)')).toBeCloseTo(-352, 6);
  });
  it('=DAYS(43845.9, 43845.1)', async () => {
    expect(await evaluate('=DAYS(43845.9, 43845.1)')).toBeCloseTo(0, 9);
  });
  it('=DAYS(DATE(2021, 3, 15), DATE(2021, 2, 1))', async () => {
    expect(await evaluate('=DAYS(DATE(2021, 3, 15), DATE(2021, 2, 1))')).toBeCloseTo(42, 7);
  });
  it('=DAYS("x", 1)', async () => {
    expect(await evaluate('=DAYS("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
