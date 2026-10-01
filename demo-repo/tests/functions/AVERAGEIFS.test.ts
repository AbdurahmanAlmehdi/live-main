// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('AVERAGEIFS', () => {
  it('=AVERAGEIFS({10, 20, 30, 40}, {"a", "b", "a", "b"}, "b")', async () => {
    expect(await evaluate('=AVERAGEIFS({10, 20, 30, 40}, {"a", "b", "a", "b"}, "b")')).toBeCloseTo(30, 7);
  });
  it('=AVERAGEIFS({10, 20, 30, 40}, {1, 2, 3, 4}, ">1", {1, 2, 3, 4}, "<4")', async () => {
    expect(await evaluate('=AVERAGEIFS({10, 20, 30, 40}, {1, 2, 3, 4}, ">1", {1, 2, 3, 4}, "<4")')).toBeCloseTo(25, 7);
  });
  it('=AVERAGEIFS({5, 6}, {"x", "y"}, "x")', async () => {
    expect(await evaluate('=AVERAGEIFS({5, 6}, {"x", "y"}, "x")')).toBeCloseTo(5, 8);
  });
  it('=AVERAGEIFS({1, 2}, {1, 2}, ">5")', async () => {
    expect(await evaluate('=AVERAGEIFS({1, 2}, {1, 2}, ">5")')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=AVERAGEIFS({1, 2, 3}, {1, 2}, ">0")', async () => {
    expect(await evaluate('=AVERAGEIFS({1, 2, 3}, {1, 2}, ">0")')).toMatchObject({ code: '#VALUE!' });
  });
});
