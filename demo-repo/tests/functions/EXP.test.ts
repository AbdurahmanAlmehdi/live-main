// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('EXP', () => {
  it('=EXP(1)', async () => {
    expect(await evaluate('=EXP(1)')).toBeCloseTo(2.718281828459045, 8);
  });
  it('=EXP(2)', async () => {
    expect(await evaluate('=EXP(2)')).toBeCloseTo(7.38905609893065, 8);
  });
  it('=EXP(0)', async () => {
    expect(await evaluate('=EXP(0)')).toBeCloseTo(1, 9);
  });
  it('=EXP(-1.5)', async () => {
    expect(await evaluate('=EXP(-1.5)')).toBeCloseTo(0.22313016014842982, 9);
  });
  it('=EXP(1000)', async () => {
    expect(await evaluate('=EXP(1000)')).toMatchObject({ code: '#NUM!' });
  });
  it('=EXP("x")', async () => {
    expect(await evaluate('=EXP("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
