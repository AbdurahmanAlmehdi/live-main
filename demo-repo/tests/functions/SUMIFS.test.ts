// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SUMIFS', () => {
  it('=SUMIFS({10, 20, 30, 40}, {"a", "b", "a", "b"}, "a")', async () => {
    expect(await evaluate('=SUMIFS({10, 20, 30, 40}, {"a", "b", "a", "b"}, "a")')).toBeCloseTo(40, 7);
  });
  it('=SUMIFS({10, 20, 30, 40}, {"a", "b", "a", "b"}, "b", {1, 2, 3, 4}, ">2")', async () => {
    expect(await evaluate('=SUMIFS({10, 20, 30, 40}, {"a", "b", "a", "b"}, "b", {1, 2, 3, 4}, ">2")')).toBeCloseTo(40, 7);
  });
  it('=SUMIFS({1, 2, 3}, {1, 2, 3}, ">=2")', async () => {
    expect(await evaluate('=SUMIFS({1, 2, 3}, {1, 2, 3}, ">=2")')).toBeCloseTo(5, 8);
  });
  it('=SUMIFS({1, 2, 3}, {"x", "y", "z"}, "q")', async () => {
    expect(await evaluate('=SUMIFS({1, 2, 3}, {"x", "y", "z"}, "q")')).toBeCloseTo(0, 9);
  });
  it('=SUMIFS({1, 2, 3}, {1, 2}, ">0")', async () => {
    expect(await evaluate('=SUMIFS({1, 2, 3}, {1, 2}, ">0")')).toMatchObject({ code: '#VALUE!' });
  });
});
