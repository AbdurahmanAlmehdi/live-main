// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('F.DIST', () => {
  it('=F.DIST(15.2069, 6, 4, TRUE)', async () => {
    expect(await evaluate('=F.DIST(15.2069, 6, 4, TRUE)')).toBeCloseTo(0.9900000430027627, 9);
  });
  it('=F.DIST(15.2069, 6, 4, FALSE)', async () => {
    expect(await evaluate('=F.DIST(15.2069, 6, 4, FALSE)')).toBeCloseTo(0.0012237917087831727, 9);
  });
  it('=F.DIST(1, 1, 1, TRUE)', async () => {
    expect(await evaluate('=F.DIST(1, 1, 1, TRUE)')).toBeCloseTo(0.5, 9);
  });
  it('=F.DIST(2.5, 5, 10, FALSE)', async () => {
    expect(await evaluate('=F.DIST(2.5, 5, 10, FALSE)')).toBeCloseTo(0.0935947544496855, 9);
  });
  it('=F.DIST(0.5, 3.9, 8, TRUE)', async () => {
    expect(await evaluate('=F.DIST(0.5, 3.9, 8, TRUE)')).toBeCloseTo(0.30737513305615366, 9);
  });
  it('=F.DIST(-1, 2, 3, TRUE)', async () => {
    expect(await evaluate('=F.DIST(-1, 2, 3, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=F.DIST(1, 0, 3, TRUE)', async () => {
    expect(await evaluate('=F.DIST(1, 0, 3, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=F.DIST("x", 2, 3, TRUE)', async () => {
    expect(await evaluate('=F.DIST("x", 2, 3, TRUE)')).toMatchObject({ code: '#VALUE!' });
  });
});
