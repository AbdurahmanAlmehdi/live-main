// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('INTERCEPT', () => {
  it('=INTERCEPT({2, 3, 9, 1, 8}, {6, 5, 11, 7, 5})', async () => {
    expect(await evaluate('=INTERCEPT({2, 3, 9, 1, 8}, {6, 5, 11, 7, 5})')).toBeCloseTo(0.04838709677419306, 9);
  });
  it('=INTERCEPT({3, 5, 7}, {1, 2, 3})', async () => {
    expect(await evaluate('=INTERCEPT({3, 5, 7}, {1, 2, 3})')).toBeCloseTo(1, 9);
  });
  it('=INTERCEPT({1, "a", 3, 4}, {2, 5, 6, 9})', async () => {
    expect(await evaluate('=INTERCEPT({1, "a", 3, 4}, {2, 5, 6, 9})')).toBeCloseTo(0.21621621621621623, 9);
  });
  it('=INTERCEPT({1, 2}, {3, 3})', async () => {
    expect(await evaluate('=INTERCEPT({1, 2}, {3, 3})')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=INTERCEPT({1, 2}, {1})', async () => {
    expect(await evaluate('=INTERCEPT({1, 2}, {1})')).toMatchObject({ code: '#N/A' });
  });
});
