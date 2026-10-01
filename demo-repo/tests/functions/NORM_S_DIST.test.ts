// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('NORM.S.DIST', () => {
  it('=NORM.S.DIST(1.333333, TRUE)', async () => {
    expect(await evaluate('=NORM.S.DIST(1.333333, TRUE)')).toBeCloseTo(0.9087887256040951, 9);
  });
  it('=NORM.S.DIST(1.333333, FALSE)', async () => {
    expect(await evaluate('=NORM.S.DIST(1.333333, FALSE)')).toBeCloseTo(0.16401014756936724, 9);
  });
  it('=NORM.S.DIST(0, TRUE)', async () => {
    expect(await evaluate('=NORM.S.DIST(0, TRUE)')).toBeCloseTo(0.5, 9);
  });
  it('=NORM.S.DIST(0, FALSE)', async () => {
    expect(await evaluate('=NORM.S.DIST(0, FALSE)')).toBeCloseTo(0.3989422804014327, 9);
  });
  it('=NORM.S.DIST(-2, TRUE)', async () => {
    expect(await evaluate('=NORM.S.DIST(-2, TRUE)')).toBeCloseTo(0.02275013194817921, 9);
  });
  it('=NORM.S.DIST(-10, TRUE)', async () => {
    expect(await evaluate('=NORM.S.DIST(-10, TRUE)')).toBeCloseTo(7.619853024160525e-24, 9);
  });
  it('=NORM.S.DIST(5, TRUE)', async () => {
    expect(await evaluate('=NORM.S.DIST(5, TRUE)')).toBeCloseTo(0.9999997133484282, 9);
  });
  it('=NORM.S.DIST("x", TRUE)', async () => {
    expect(await evaluate('=NORM.S.DIST("x", TRUE)')).toMatchObject({ code: '#VALUE!' });
  });
});
