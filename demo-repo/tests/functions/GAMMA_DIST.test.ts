// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('GAMMA.DIST', () => {
  it('=GAMMA.DIST(10.00001131, 9, 2, TRUE)', async () => {
    expect(await evaluate('=GAMMA.DIST(10.00001131, 9, 2, TRUE)')).toBeCloseTo(0.06809400386977123, 9);
  });
  it('=GAMMA.DIST(10.00001131, 9, 2, FALSE)', async () => {
    expect(await evaluate('=GAMMA.DIST(10.00001131, 9, 2, FALSE)')).toBeCloseTo(0.0326391304182863, 9);
  });
  it('=GAMMA.DIST(1, 1, 1, TRUE)', async () => {
    expect(await evaluate('=GAMMA.DIST(1, 1, 1, TRUE)')).toBeCloseTo(0.6321205588285578, 9);
  });
  it('=GAMMA.DIST(2, 0.5, 1, FALSE)', async () => {
    expect(await evaluate('=GAMMA.DIST(2, 0.5, 1, FALSE)')).toBeCloseTo(0.05399096651318573, 9);
  });
  it('=GAMMA.DIST(30, 3, 2, TRUE)', async () => {
    expect(await evaluate('=GAMMA.DIST(30, 3, 2, TRUE)')).toBeCloseTo(0.9999606915518156, 9);
  });
  it('=GAMMA.DIST(0, 2, 1, TRUE)', async () => {
    expect(await evaluate('=GAMMA.DIST(0, 2, 1, TRUE)')).toBeCloseTo(0, 9);
  });
  it('=GAMMA.DIST(-1, 2, 1, TRUE)', async () => {
    expect(await evaluate('=GAMMA.DIST(-1, 2, 1, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=GAMMA.DIST(1, 0, 1, TRUE)', async () => {
    expect(await evaluate('=GAMMA.DIST(1, 0, 1, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=GAMMA.DIST(1, 2, 0, TRUE)', async () => {
    expect(await evaluate('=GAMMA.DIST(1, 2, 0, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=GAMMA.DIST("x", 2, 1, TRUE)', async () => {
    expect(await evaluate('=GAMMA.DIST("x", 2, 1, TRUE)')).toMatchObject({ code: '#VALUE!' });
  });
});
