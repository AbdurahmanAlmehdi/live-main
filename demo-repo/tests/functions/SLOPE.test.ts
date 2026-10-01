// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SLOPE', () => {
  it('=SLOPE({2, 3, 9, 1, 8, 7, 5}, {6, 5, 11, 7, 5, 4, 4})', async () => {
    expect(await evaluate('=SLOPE({2, 3, 9, 1, 8, 7, 5}, {6, 5, 11, 7, 5, 4, 4})')).toBeCloseTo(0.3055555555555556, 9);
  });
  it('=SLOPE({2, 4, 6}, {1, 2, 3})', async () => {
    expect(await evaluate('=SLOPE({2, 4, 6}, {1, 2, 3})')).toBeCloseTo(2, 8);
  });
  it('=SLOPE({1, "a", 3, 4}, {2, 5, 6, 9})', async () => {
    expect(await evaluate('=SLOPE({1, "a", 3, 4}, {2, 5, 6, 9})')).toBeCloseTo(0.4324324324324324, 9);
  });
  it('=SLOPE({1, 2}, {3, 3})', async () => {
    expect(await evaluate('=SLOPE({1, 2}, {3, 3})')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=SLOPE({1, 2}, {1})', async () => {
    expect(await evaluate('=SLOPE({1, 2}, {1})')).toMatchObject({ code: '#N/A' });
  });
});
