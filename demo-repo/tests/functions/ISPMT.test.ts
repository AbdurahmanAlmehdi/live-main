// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ISPMT', () => {
  it('=ISPMT(0.1/12, 1, 3*12, 8000000)', async () => {
    expect(await evaluate('=ISPMT(0.1/12, 1, 3*12, 8000000)')).toBeCloseTo(-64814.81481481482, 4);
  });
  it('=ISPMT(0.1, 1, 3, 8000000)', async () => {
    expect(await evaluate('=ISPMT(0.1, 1, 3, 8000000)')).toBeCloseTo(-533333.3333333334, 3);
  });
  it('=ISPMT(0.1, 0, 3, 1000)', async () => {
    expect(await evaluate('=ISPMT(0.1, 0, 3, 1000)')).toBeCloseTo(-100, 7);
  });
  it('=ISPMT(0.1, 3, 3, 1000)', async () => {
    expect(await evaluate('=ISPMT(0.1, 3, 3, 1000)')).toBeCloseTo(0, 9);
  });
  it('=ISPMT(0.1, 1, 0, 1000)', async () => {
    expect(await evaluate('=ISPMT(0.1, 1, 0, 1000)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=ISPMT("x", 1, 3, 1000)', async () => {
    expect(await evaluate('=ISPMT("x", 1, 3, 1000)')).toMatchObject({ code: '#VALUE!' });
  });
});
