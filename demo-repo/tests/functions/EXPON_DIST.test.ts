// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('EXPON.DIST', () => {
  it('=EXPON.DIST(0.2, 10, TRUE)', async () => {
    expect(await evaluate('=EXPON.DIST(0.2, 10, TRUE)')).toBeCloseTo(0.8646647167633873, 9);
  });
  it('=EXPON.DIST(0.2, 10, FALSE)', async () => {
    expect(await evaluate('=EXPON.DIST(0.2, 10, FALSE)')).toBeCloseTo(1.353352832366127, 8);
  });
  it('=EXPON.DIST(0, 3, TRUE)', async () => {
    expect(await evaluate('=EXPON.DIST(0, 3, TRUE)')).toBeCloseTo(0, 9);
  });
  it('=EXPON.DIST(0, 3, FALSE)', async () => {
    expect(await evaluate('=EXPON.DIST(0, 3, FALSE)')).toBeCloseTo(3, 8);
  });
  it('=EXPON.DIST(2, 0.5, TRUE)', async () => {
    expect(await evaluate('=EXPON.DIST(2, 0.5, TRUE)')).toBeCloseTo(0.6321205588285577, 9);
  });
  it('=EXPON.DIST(-1, 1, TRUE)', async () => {
    expect(await evaluate('=EXPON.DIST(-1, 1, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=EXPON.DIST(1, 0, TRUE)', async () => {
    expect(await evaluate('=EXPON.DIST(1, 0, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=EXPON.DIST("x", 1, TRUE)', async () => {
    expect(await evaluate('=EXPON.DIST("x", 1, TRUE)')).toMatchObject({ code: '#VALUE!' });
  });
});
