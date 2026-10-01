// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SUMXMY2', () => {
  it('=SUMXMY2({2, 3, 9, 1, 8, 7, 5}, {6, 5, 11, 7, 5, 4, 4})', async () => {
    expect(await evaluate('=SUMXMY2({2, 3, 9, 1, 8, 7, 5}, {6, 5, 11, 7, 5, 4, 4})')).toBeCloseTo(79, 7);
  });
  it('=SUMXMY2({1, 2}, {3, 4})', async () => {
    expect(await evaluate('=SUMXMY2({1, 2}, {3, 4})')).toBeCloseTo(8, 8);
  });
  it('=SUMXMY2({1, "a", 3}, {1, 2, 5})', async () => {
    expect(await evaluate('=SUMXMY2({1, "a", 3}, {1, 2, 5})')).toBeCloseTo(4, 8);
  });
  it('=SUMXMY2(5, 3)', async () => {
    expect(await evaluate('=SUMXMY2(5, 3)')).toBeCloseTo(4, 8);
  });
  it('=SUMXMY2({1, 2}, {1, 2, 3})', async () => {
    expect(await evaluate('=SUMXMY2({1, 2}, {1, 2, 3})')).toMatchObject({ code: '#N/A' });
  });
});
