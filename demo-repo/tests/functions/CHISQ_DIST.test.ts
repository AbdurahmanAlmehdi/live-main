// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('CHISQ.DIST', () => {
  it('=CHISQ.DIST(0.5, 1, TRUE)', async () => {
    expect(await evaluate('=CHISQ.DIST(0.5, 1, TRUE)')).toBeCloseTo(0.5204998778130242, 9);
  });
  it('=CHISQ.DIST(2, 3, FALSE)', async () => {
    expect(await evaluate('=CHISQ.DIST(2, 3, FALSE)')).toBeCloseTo(0.20755374871029836, 9);
  });
  it('=CHISQ.DIST(3.84, 1, TRUE)', async () => {
    expect(await evaluate('=CHISQ.DIST(3.84, 1, TRUE)')).toBeCloseTo(0.9499564787527659, 9);
  });
  it('=CHISQ.DIST(10, 4, TRUE)', async () => {
    expect(await evaluate('=CHISQ.DIST(10, 4, TRUE)')).toBeCloseTo(0.9595723180054873, 9);
  });
  it('=CHISQ.DIST(2, 3.9, FALSE)', async () => {
    expect(await evaluate('=CHISQ.DIST(2, 3.9, FALSE)')).toBeCloseTo(0.20755374871029736, 9);
  });
  it('=CHISQ.DIST(0, 2, TRUE)', async () => {
    expect(await evaluate('=CHISQ.DIST(0, 2, TRUE)')).toBeCloseTo(0, 9);
  });
  it('=CHISQ.DIST(-1, 2, TRUE)', async () => {
    expect(await evaluate('=CHISQ.DIST(-1, 2, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=CHISQ.DIST(1, 0, TRUE)', async () => {
    expect(await evaluate('=CHISQ.DIST(1, 0, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=CHISQ.DIST("x", 2, TRUE)', async () => {
    expect(await evaluate('=CHISQ.DIST("x", 2, TRUE)')).toMatchObject({ code: '#VALUE!' });
  });
});
