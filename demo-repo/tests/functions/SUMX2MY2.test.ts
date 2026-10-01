// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SUMX2MY2', () => {
  it('=SUMX2MY2({2, 3, 9, 1, 8, 7, 5}, {6, 5, 11, 7, 5, 4, 4})', async () => {
    expect(await evaluate('=SUMX2MY2({2, 3, 9, 1, 8, 7, 5}, {6, 5, 11, 7, 5, 4, 4})')).toBeCloseTo(-55, 7);
  });
  it('=SUMX2MY2({1, 2}, {3, 4})', async () => {
    expect(await evaluate('=SUMX2MY2({1, 2}, {3, 4})')).toBeCloseTo(-20, 7);
  });
  it('=SUMX2MY2({1, "a", 3}, {1, 2, 3})', async () => {
    expect(await evaluate('=SUMX2MY2({1, "a", 3}, {1, 2, 3})')).toBeCloseTo(0, 9);
  });
  it('=SUMX2MY2(5, 3)', async () => {
    expect(await evaluate('=SUMX2MY2(5, 3)')).toBeCloseTo(16, 7);
  });
  it('=SUMX2MY2({1, 2}, {1, 2, 3})', async () => {
    expect(await evaluate('=SUMX2MY2({1, 2}, {1, 2, 3})')).toMatchObject({ code: '#N/A' });
  });
});
