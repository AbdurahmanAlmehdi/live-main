// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('T.DIST', () => {
  it('=T.DIST(60, 1, TRUE)', async () => {
    expect(await evaluate('=T.DIST(60, 1, TRUE)')).toBeCloseTo(0.9946953263673767, 9);
  });
  it('=T.DIST(8, 3, FALSE)', async () => {
    expect(await evaluate('=T.DIST(8, 3, FALSE)')).toBeCloseTo(0.0007369065209469263, 9);
  });
  it('=T.DIST(0, 5, TRUE)', async () => {
    expect(await evaluate('=T.DIST(0, 5, TRUE)')).toBeCloseTo(0.5, 9);
  });
  it('=T.DIST(-1.5, 10, TRUE)', async () => {
    expect(await evaluate('=T.DIST(-1.5, 10, TRUE)')).toBeCloseTo(0.08225366322272008, 9);
  });
  it('=T.DIST(2, 30, FALSE)', async () => {
    expect(await evaluate('=T.DIST(2, 30, FALSE)')).toBeCloseTo(0.05685227504719796, 9);
  });
  it('=T.DIST(1, 2, TRUE)', async () => {
    expect(await evaluate('=T.DIST(1, 2, TRUE)')).toBeCloseTo(0.7886751345948129, 9);
  });
  it('=T.DIST(-3, 4, FALSE)', async () => {
    expect(await evaluate('=T.DIST(-3, 4, FALSE)')).toBeCloseTo(0.019693498090836536, 9);
  });
  it('=T.DIST(1, 0, TRUE)', async () => {
    expect(await evaluate('=T.DIST(1, 0, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=T.DIST("x", 5, TRUE)', async () => {
    expect(await evaluate('=T.DIST("x", 5, TRUE)')).toMatchObject({ code: '#VALUE!' });
  });
});
