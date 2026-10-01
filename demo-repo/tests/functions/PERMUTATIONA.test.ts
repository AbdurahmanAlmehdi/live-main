// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('PERMUTATIONA', () => {
  it('=PERMUTATIONA(3, 2)', async () => {
    expect(await evaluate('=PERMUTATIONA(3, 2)')).toBeCloseTo(9, 8);
  });
  it('=PERMUTATIONA(2, 2)', async () => {
    expect(await evaluate('=PERMUTATIONA(2, 2)')).toBeCloseTo(4, 8);
  });
  it('=PERMUTATIONA(10, 0)', async () => {
    expect(await evaluate('=PERMUTATIONA(10, 0)')).toBeCloseTo(1, 9);
  });
  it('=PERMUTATIONA(4.9, 2)', async () => {
    expect(await evaluate('=PERMUTATIONA(4.9, 2)')).toBeCloseTo(16, 7);
  });
  it('=PERMUTATIONA(-1, 2)', async () => {
    expect(await evaluate('=PERMUTATIONA(-1, 2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=PERMUTATIONA("x", 1)', async () => {
    expect(await evaluate('=PERMUTATIONA("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
