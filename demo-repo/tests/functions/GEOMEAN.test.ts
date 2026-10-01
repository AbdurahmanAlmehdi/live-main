// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('GEOMEAN', () => {
  it('=GEOMEAN(4, 5, 8, 7, 11, 4, 3)', async () => {
    expect(await evaluate('=GEOMEAN(4, 5, 8, 7, 11, 4, 3)')).toBeCloseTo(5.476986969656962, 8);
  });
  it('=GEOMEAN({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})', async () => {
    expect(await evaluate('=GEOMEAN({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})')).toBeCloseTo(4.057552780441771, 8);
  });
  it('=GEOMEAN({2, "a", 8})', async () => {
    expect(await evaluate('=GEOMEAN({2, "a", 8})')).toBeCloseTo(4, 8);
  });
  it('=GEOMEAN(5)', async () => {
    expect(await evaluate('=GEOMEAN(5)')).toBeCloseTo(5, 8);
  });
  it('=GEOMEAN(1, 0)', async () => {
    expect(await evaluate('=GEOMEAN(1, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=GEOMEAN(1, -2)', async () => {
    expect(await evaluate('=GEOMEAN(1, -2)')).toMatchObject({ code: '#NUM!' });
  });
});
