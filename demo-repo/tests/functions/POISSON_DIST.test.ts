// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('POISSON.DIST', () => {
  it('=POISSON.DIST(2, 5, FALSE)', async () => {
    expect(await evaluate('=POISSON.DIST(2, 5, FALSE)')).toBeCloseTo(0.08422433748856833, 9);
  });
  it('=POISSON.DIST(2, 5, TRUE)', async () => {
    expect(await evaluate('=POISSON.DIST(2, 5, TRUE)')).toBeCloseTo(0.12465201948308113, 9);
  });
  it('=POISSON.DIST(0, 0, FALSE)', async () => {
    expect(await evaluate('=POISSON.DIST(0, 0, FALSE)')).toBeCloseTo(1, 9);
  });
  it('=POISSON.DIST(10, 3.5, FALSE)', async () => {
    expect(await evaluate('=POISSON.DIST(10, 3.5, FALSE)')).toBeCloseTo(0.002295549827015358, 9);
  });
  it('=POISSON.DIST(2.9, 5, FALSE)', async () => {
    expect(await evaluate('=POISSON.DIST(2.9, 5, FALSE)')).toBeCloseTo(0.08422433748856833, 9);
  });
  it('=POISSON.DIST(20, 15, TRUE)', async () => {
    expect(await evaluate('=POISSON.DIST(20, 15, TRUE)')).toBeCloseTo(0.9170290899685397, 9);
  });
  it('=POISSON.DIST(-1, 5, TRUE)', async () => {
    expect(await evaluate('=POISSON.DIST(-1, 5, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=POISSON.DIST(2, -1, TRUE)', async () => {
    expect(await evaluate('=POISSON.DIST(2, -1, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=POISSON.DIST("x", 5, TRUE)', async () => {
    expect(await evaluate('=POISSON.DIST("x", 5, TRUE)')).toMatchObject({ code: '#VALUE!' });
  });
});
