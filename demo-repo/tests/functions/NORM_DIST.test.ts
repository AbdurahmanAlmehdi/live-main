// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('NORM.DIST', () => {
  it('=NORM.DIST(42, 40, 1.5, TRUE)', async () => {
    expect(await evaluate('=NORM.DIST(42, 40, 1.5, TRUE)')).toBeCloseTo(0.9087887802741321, 9);
  });
  it('=NORM.DIST(42, 40, 1.5, FALSE)', async () => {
    expect(await evaluate('=NORM.DIST(42, 40, 1.5, FALSE)')).toBeCloseTo(0.10934004978399574, 9);
  });
  it('=NORM.DIST(40, 40, 1.5, TRUE)', async () => {
    expect(await evaluate('=NORM.DIST(40, 40, 1.5, TRUE)')).toBeCloseTo(0.5, 9);
  });
  it('=NORM.DIST(-1, 0, 1, TRUE)', async () => {
    expect(await evaluate('=NORM.DIST(-1, 0, 1, TRUE)')).toBeCloseTo(0.15865525393145707, 9);
  });
  it('=NORM.DIST(10, 0, 1, FALSE)', async () => {
    expect(await evaluate('=NORM.DIST(10, 0, 1, FALSE)')).toBeCloseTo(7.69459862670641e-23, 9);
  });
  it('=NORM.DIST(-8, 0, 1, TRUE)', async () => {
    expect(await evaluate('=NORM.DIST(-8, 0, 1, TRUE)')).toBeCloseTo(6.220960574271784e-16, 9);
  });
  it('=NORM.DIST(1, 0, 0, TRUE)', async () => {
    expect(await evaluate('=NORM.DIST(1, 0, 0, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=NORM.DIST(1, 0, -1, FALSE)', async () => {
    expect(await evaluate('=NORM.DIST(1, 0, -1, FALSE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=NORM.DIST("x", 0, 1, TRUE)', async () => {
    expect(await evaluate('=NORM.DIST("x", 0, 1, TRUE)')).toMatchObject({ code: '#VALUE!' });
  });
});
