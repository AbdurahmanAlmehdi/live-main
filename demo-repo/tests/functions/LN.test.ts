// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('LN', () => {
  it('=LN(86)', async () => {
    expect(await evaluate('=LN(86)')).toBeCloseTo(4.454347296253507, 8);
  });
  it('=LN(EXP(3))', async () => {
    expect(await evaluate('=LN(EXP(3))')).toBeCloseTo(3, 8);
  });
  it('=LN(1)', async () => {
    expect(await evaluate('=LN(1)')).toBeCloseTo(0, 9);
  });
  it('=LN(0)', async () => {
    expect(await evaluate('=LN(0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=LN(-1)', async () => {
    expect(await evaluate('=LN(-1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=LN("x")', async () => {
    expect(await evaluate('=LN("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
