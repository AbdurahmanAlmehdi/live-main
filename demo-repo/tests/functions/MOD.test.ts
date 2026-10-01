// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('MOD', () => {
  it('=MOD(3, 2)', async () => {
    expect(await evaluate('=MOD(3, 2)')).toBeCloseTo(1, 9);
  });
  it('=MOD(-3, 2)', async () => {
    expect(await evaluate('=MOD(-3, 2)')).toBeCloseTo(1, 9);
  });
  it('=MOD(3, -2)', async () => {
    expect(await evaluate('=MOD(3, -2)')).toBeCloseTo(-1, 9);
  });
  it('=MOD(-3, -2)', async () => {
    expect(await evaluate('=MOD(-3, -2)')).toBeCloseTo(-1, 9);
  });
  it('=MOD(5.5, 2)', async () => {
    expect(await evaluate('=MOD(5.5, 2)')).toBeCloseTo(1.5, 8);
  });
  it('=MOD(0, 5)', async () => {
    expect(await evaluate('=MOD(0, 5)')).toBeCloseTo(0, 9);
  });
  it('=MOD(3, 0)', async () => {
    expect(await evaluate('=MOD(3, 0)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=MOD("x", 2)', async () => {
    expect(await evaluate('=MOD("x", 2)')).toMatchObject({ code: '#VALUE!' });
  });
});
