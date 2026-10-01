// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('COUNTIF', () => {
  it('=COUNTIF({"apples", "oranges", "peaches", "apples"}, "apples")', async () => {
    expect(await evaluate('=COUNTIF({"apples", "oranges", "peaches", "apples"}, "apples")')).toBeCloseTo(2, 8);
  });
  it('=COUNTIF({32, 54, 75, 86}, ">55")', async () => {
    expect(await evaluate('=COUNTIF({32, 54, 75, 86}, ">55")')).toBeCloseTo(2, 8);
  });
  it('=COUNTIF({32, 54, 75, 86}, "<>75")', async () => {
    expect(await evaluate('=COUNTIF({32, 54, 75, 86}, "<>75")')).toBeCloseTo(3, 8);
  });
  it('=COUNTIF({"apples", "oranges", "Apples"}, "a*")', async () => {
    expect(await evaluate('=COUNTIF({"apples", "oranges", "Apples"}, "a*")')).toBeCloseTo(2, 8);
  });
  it('=COUNTIF({"apples", "oranges", "peaches"}, "?????es")', async () => {
    expect(await evaluate('=COUNTIF({"apples", "oranges", "peaches"}, "?????es")')).toBeCloseTo(2, 8);
  });
  it('=COUNTIF({1, 2, 2, 3}, 2)', async () => {
    expect(await evaluate('=COUNTIF({1, 2, 2, 3}, 2)')).toBeCloseTo(2, 8);
  });
  it('=COUNTIF({TRUE, FALSE, TRUE}, TRUE)', async () => {
    expect(await evaluate('=COUNTIF({TRUE, FALSE, TRUE}, TRUE)')).toBeCloseTo(2, 8);
  });
  it('=COUNTIF({"x", "", "y"}, "")', async () => {
    expect(await evaluate('=COUNTIF({"x", "", "y"}, "")')).toBeCloseTo(1, 9);
  });
});
