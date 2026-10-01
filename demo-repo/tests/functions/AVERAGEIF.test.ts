// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('AVERAGEIF', () => {
  it('=AVERAGEIF({100, 200, 300, 400}, "<250")', async () => {
    expect(await evaluate('=AVERAGEIF({100, 200, 300, 400}, "<250")')).toBeCloseTo(150, 6);
  });
  it('=AVERAGEIF({"a", "b", "a"}, "a", {10, 20, 40})', async () => {
    expect(await evaluate('=AVERAGEIF({"a", "b", "a"}, "a", {10, 20, 40})')).toBeCloseTo(25, 7);
  });
  it('=AVERAGEIF({1, 2, 3, 4}, ">=2")', async () => {
    expect(await evaluate('=AVERAGEIF({1, 2, 3, 4}, ">=2")')).toBeCloseTo(3, 8);
  });
  it('=AVERAGEIF({"apple", "avocado", "kiwi"}, "a*", {2, 4, 9})', async () => {
    expect(await evaluate('=AVERAGEIF({"apple", "avocado", "kiwi"}, "a*", {2, 4, 9})')).toBeCloseTo(3, 8);
  });
  it('=AVERAGEIF({1, 2, 3}, ">5")', async () => {
    expect(await evaluate('=AVERAGEIF({1, 2, 3}, ">5")')).toMatchObject({ code: '#DIV/0!' });
  });
});
