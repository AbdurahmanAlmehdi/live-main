// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('PPMT', () => {
  it('=PPMT(0.1/12, 1, 2*12, 2000)', async () => {
    expect(await evaluate('=PPMT(0.1/12, 1, 2*12, 2000)')).toBeCloseTo(-75.62318600836667, 7);
  });
  it('=PPMT(0.08, 10, 10, 200000)', async () => {
    expect(await evaluate('=PPMT(0.08, 10, 10, 200000)')).toBeCloseTo(-27598.053462421354, 4);
  });
  it('=PPMT(0.1, 1, 3, 8000, 0, 1)', async () => {
    expect(await evaluate('=PPMT(0.1, 1, 3, 8000, 0, 1)')).toBeCloseTo(-2924.4712990936528, 5);
  });
  it('=PPMT(0.05, 3, 10, -5000, 1000, 1)', async () => {
    expect(await evaluate('=PPMT(0.05, 3, 10, -5000, 1000, 1)')).toBeCloseTo(333.91921485491764, 6);
  });
  it('=PPMT(0, 2, 4, 1000)', async () => {
    expect(await evaluate('=PPMT(0, 2, 4, 1000)')).toBeCloseTo(-250, 6);
  });
  it('=PPMT(0.1, 5, 3, 8000)', async () => {
    expect(await evaluate('=PPMT(0.1, 5, 3, 8000)')).toMatchObject({ code: '#NUM!' });
  });
  it('=PPMT("x", 1, 3, 8000)', async () => {
    expect(await evaluate('=PPMT("x", 1, 3, 8000)')).toMatchObject({ code: '#VALUE!' });
  });
});
