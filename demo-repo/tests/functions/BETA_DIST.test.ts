// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('BETA.DIST', () => {
  it('=BETA.DIST(2, 8, 10, TRUE, 1, 3)', async () => {
    expect(await evaluate('=BETA.DIST(2, 8, 10, TRUE, 1, 3)')).toBeCloseTo(0.6854705810546875, 9);
  });
  it('=BETA.DIST(2, 8, 10, FALSE, 1, 3)', async () => {
    expect(await evaluate('=BETA.DIST(2, 8, 10, FALSE, 1, 3)')).toBeCloseTo(1.4837646484375, 8);
  });
  it('=BETA.DIST(0.4, 2, 3, TRUE)', async () => {
    expect(await evaluate('=BETA.DIST(0.4, 2, 3, TRUE)')).toBeCloseTo(0.5248000000000007, 9);
  });
  it('=BETA.DIST(0.4, 2, 3, FALSE)', async () => {
    expect(await evaluate('=BETA.DIST(0.4, 2, 3, FALSE)')).toBeCloseTo(1.728, 8);
  });
  it('=BETA.DIST(0.5, 1, 1, TRUE)', async () => {
    expect(await evaluate('=BETA.DIST(0.5, 1, 1, TRUE)')).toBeCloseTo(0.5000000000000002, 9);
  });
  it('=BETA.DIST(0.9, 0.5, 0.5, TRUE)', async () => {
    expect(await evaluate('=BETA.DIST(0.9, 0.5, 0.5, TRUE)')).toBeCloseTo(0.7951672353008665, 9);
  });
  it('=BETA.DIST(1.5, 2, 3, TRUE)', async () => {
    expect(await evaluate('=BETA.DIST(1.5, 2, 3, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BETA.DIST(0.5, 0, 3, TRUE)', async () => {
    expect(await evaluate('=BETA.DIST(0.5, 0, 3, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BETA.DIST(2, 2, 3, TRUE, 2, 2)', async () => {
    expect(await evaluate('=BETA.DIST(2, 2, 3, TRUE, 2, 2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BETA.DIST("x", 2, 3, TRUE)', async () => {
    expect(await evaluate('=BETA.DIST("x", 2, 3, TRUE)')).toMatchObject({ code: '#VALUE!' });
  });
});
