// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('BINOM.DIST', () => {
  it('=BINOM.DIST(6, 10, 0.5, FALSE)', async () => {
    expect(await evaluate('=BINOM.DIST(6, 10, 0.5, FALSE)')).toBeCloseTo(0.205078125, 9);
  });
  it('=BINOM.DIST(6, 10, 0.5, TRUE)', async () => {
    expect(await evaluate('=BINOM.DIST(6, 10, 0.5, TRUE)')).toBeCloseTo(0.828125, 9);
  });
  it('=BINOM.DIST(0, 5, 0.2, FALSE)', async () => {
    expect(await evaluate('=BINOM.DIST(0, 5, 0.2, FALSE)')).toBeCloseTo(0.3276800000000001, 9);
  });
  it('=BINOM.DIST(3, 20, 0.1, TRUE)', async () => {
    expect(await evaluate('=BINOM.DIST(3, 20, 0.1, TRUE)')).toBeCloseTo(0.8670466765656649, 9);
  });
  it('=BINOM.DIST(6.9, 10.2, 0.5, FALSE)', async () => {
    expect(await evaluate('=BINOM.DIST(6.9, 10.2, 0.5, FALSE)')).toBeCloseTo(0.205078125, 9);
  });
  it('=BINOM.DIST(5, 5, 1, FALSE)', async () => {
    expect(await evaluate('=BINOM.DIST(5, 5, 1, FALSE)')).toBeCloseTo(1, 9);
  });
  it('=BINOM.DIST(11, 10, 0.5, FALSE)', async () => {
    expect(await evaluate('=BINOM.DIST(11, 10, 0.5, FALSE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BINOM.DIST(-1, 10, 0.5, TRUE)', async () => {
    expect(await evaluate('=BINOM.DIST(-1, 10, 0.5, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BINOM.DIST(2, 10, 1.5, TRUE)', async () => {
    expect(await evaluate('=BINOM.DIST(2, 10, 1.5, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BINOM.DIST("x", 10, 0.5, TRUE)', async () => {
    expect(await evaluate('=BINOM.DIST("x", 10, 0.5, TRUE)')).toMatchObject({ code: '#VALUE!' });
  });
});
