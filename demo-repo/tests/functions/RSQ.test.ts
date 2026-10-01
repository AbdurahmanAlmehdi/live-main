// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('RSQ', () => {
  it('=RSQ({2, 3, 9, 1, 8, 7, 5}, {6, 5, 11, 7, 5, 4, 4})', async () => {
    expect(await evaluate('=RSQ({2, 3, 9, 1, 8, 7, 5}, {6, 5, 11, 7, 5, 4, 4})')).toBeCloseTo(0.05795019157088122, 9);
  });
  it('=RSQ({1, 2, 3}, {2, 4, 6})', async () => {
    expect(await evaluate('=RSQ({1, 2, 3}, {2, 4, 6})')).toBeCloseTo(1, 9);
  });
  it('=RSQ({1, "a", 3, 4}, {2, 5, 6, 9})', async () => {
    expect(await evaluate('=RSQ({1, "a", 3, 4}, {2, 5, 6, 9})')).toBeCloseTo(0.988416988416988, 9);
  });
  it('=RSQ({1, 1}, {1, 2})', async () => {
    expect(await evaluate('=RSQ({1, 1}, {1, 2})')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=RSQ({1, 2}, {1})', async () => {
    expect(await evaluate('=RSQ({1, 2}, {1})')).toMatchObject({ code: '#N/A' });
  });
});
