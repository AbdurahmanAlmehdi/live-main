// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SMALL', () => {
  it('=SMALL({3, 5, 3, 5, 4}, 3)', async () => {
    expect(await evaluate('=SMALL({3, 5, 3, 5, 4}, 3)')).toBeCloseTo(4, 8);
  });
  it('=SMALL({3, 4, 5, 2, 3, 4, 5, 6, 4, 7}, 1)', async () => {
    expect(await evaluate('=SMALL({3, 4, 5, 2, 3, 4, 5, 6, 4, 7}, 1)')).toBeCloseTo(2, 8);
  });
  it('=SMALL({3, 5, 3, 5, 4}, 2)', async () => {
    expect(await evaluate('=SMALL({3, 5, 3, 5, 4}, 2)')).toBeCloseTo(3, 8);
  });
  it('=SMALL({1, "a", 2}, 2)', async () => {
    expect(await evaluate('=SMALL({1, "a", 2}, 2)')).toBeCloseTo(2, 8);
  });
  it('=SMALL({1, 2}, 3)', async () => {
    expect(await evaluate('=SMALL({1, 2}, 3)')).toMatchObject({ code: '#NUM!' });
  });
  it('=SMALL({1, 2}, 0)', async () => {
    expect(await evaluate('=SMALL({1, 2}, 0)')).toMatchObject({ code: '#NUM!' });
  });
});
