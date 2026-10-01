// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SUMIF', () => {
  it('=SUMIF({1, 2, 3, 4}, ">2")', async () => {
    expect(await evaluate('=SUMIF({1, 2, 3, 4}, ">2")')).toBeCloseTo(7, 8);
  });
  it('=SUMIF({"a", "b", "a"}, "a", {10, 20, 30})', async () => {
    expect(await evaluate('=SUMIF({"a", "b", "a"}, "a", {10, 20, 30})')).toBeCloseTo(40, 7);
  });
  it('=SUMIF({1, 2, 3, 4}, "<>2")', async () => {
    expect(await evaluate('=SUMIF({1, 2, 3, 4}, "<>2")')).toBeCloseTo(8, 8);
  });
  it('=SUMIF({"apple", "avocado", "banana"}, "a*", {1, 2, 3})', async () => {
    expect(await evaluate('=SUMIF({"apple", "avocado", "banana"}, "a*", {1, 2, 3})')).toBeCloseTo(3, 8);
  });
  it('=SUMIF({1, 2, 3}, 2)', async () => {
    expect(await evaluate('=SUMIF({1, 2, 3}, 2)')).toBeCloseTo(2, 8);
  });
  it('=SUMIF({1, 2, 3}, ">5")', async () => {
    expect(await evaluate('=SUMIF({1, 2, 3}, ">5")')).toBeCloseTo(0, 9);
  });
  it('=SUMIF({"x", 5, 6}, ">=5")', async () => {
    expect(await evaluate('=SUMIF({"x", 5, 6}, ">=5")')).toBeCloseTo(11, 7);
  });
});
