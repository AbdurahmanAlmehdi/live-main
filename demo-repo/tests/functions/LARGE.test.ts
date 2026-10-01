// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('LARGE', () => {
  it('=LARGE({3, 5, 3, 5, 4}, 3)', async () => {
    expect(await evaluate('=LARGE({3, 5, 3, 5, 4}, 3)')).toBeCloseTo(4, 8);
  });
  it('=LARGE({3, 4, 5, 2, 3, 4, 5, 6, 4, 7}, 1)', async () => {
    expect(await evaluate('=LARGE({3, 4, 5, 2, 3, 4, 5, 6, 4, 7}, 1)')).toBeCloseTo(7, 8);
  });
  it('=LARGE({3, 5, 3, 5, 4}, 2)', async () => {
    expect(await evaluate('=LARGE({3, 5, 3, 5, 4}, 2)')).toBeCloseTo(5, 8);
  });
  it('=LARGE({1, "a", 2}, 2)', async () => {
    expect(await evaluate('=LARGE({1, "a", 2}, 2)')).toBeCloseTo(1, 9);
  });
  it('=LARGE({1, 2}, 3)', async () => {
    expect(await evaluate('=LARGE({1, 2}, 3)')).toMatchObject({ code: '#NUM!' });
  });
  it('=LARGE({1, 2}, 0)', async () => {
    expect(await evaluate('=LARGE({1, 2}, 0)')).toMatchObject({ code: '#NUM!' });
  });
});
