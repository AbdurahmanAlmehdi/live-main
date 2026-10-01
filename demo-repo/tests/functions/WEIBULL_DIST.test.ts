// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('WEIBULL.DIST', () => {
  it('=WEIBULL.DIST(105, 20, 100, TRUE)', async () => {
    expect(await evaluate('=WEIBULL.DIST(105, 20, 100, TRUE)')).toBeCloseTo(0.9295813900692769, 9);
  });
  it('=WEIBULL.DIST(105, 20, 100, FALSE)', async () => {
    expect(await evaluate('=WEIBULL.DIST(105, 20, 100, FALSE)')).toBeCloseTo(0.035588864024504306, 9);
  });
  it('=WEIBULL.DIST(1, 1, 1, TRUE)', async () => {
    expect(await evaluate('=WEIBULL.DIST(1, 1, 1, TRUE)')).toBeCloseTo(0.6321205588285577, 9);
  });
  it('=WEIBULL.DIST(2, 0.5, 3, FALSE)', async () => {
    expect(await evaluate('=WEIBULL.DIST(2, 0.5, 3, FALSE)')).toBeCloseTo(0.0902182543411035, 9);
  });
  it('=WEIBULL.DIST(0, 2, 1, TRUE)', async () => {
    expect(await evaluate('=WEIBULL.DIST(0, 2, 1, TRUE)')).toBeCloseTo(0, 9);
  });
  it('=WEIBULL.DIST(-1, 2, 1, TRUE)', async () => {
    expect(await evaluate('=WEIBULL.DIST(-1, 2, 1, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=WEIBULL.DIST(1, 0, 1, TRUE)', async () => {
    expect(await evaluate('=WEIBULL.DIST(1, 0, 1, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=WEIBULL.DIST("x", 2, 1, TRUE)', async () => {
    expect(await evaluate('=WEIBULL.DIST("x", 2, 1, TRUE)')).toMatchObject({ code: '#VALUE!' });
  });
});
