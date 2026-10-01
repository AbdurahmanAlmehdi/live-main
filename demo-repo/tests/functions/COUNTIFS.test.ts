// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('COUNTIFS', () => {
  it('=COUNTIFS({"a", "b", "a", "a"}, "a", {1, 2, 3, 4}, ">1")', async () => {
    expect(await evaluate('=COUNTIFS({"a", "b", "a", "a"}, "a", {1, 2, 3, 4}, ">1")')).toBeCloseTo(2, 8);
  });
  it('=COUNTIFS({1, 2, 3, 4}, ">=2")', async () => {
    expect(await evaluate('=COUNTIFS({1, 2, 3, 4}, ">=2")')).toBeCloseTo(3, 8);
  });
  it('=COUNTIFS({"x", "y"}, "z")', async () => {
    expect(await evaluate('=COUNTIFS({"x", "y"}, "z")')).toBeCloseTo(0, 9);
  });
  it('=COUNTIFS({"Yes", "No", "yes"}, "yes", {1, 1, 0}, 1)', async () => {
    expect(await evaluate('=COUNTIFS({"Yes", "No", "yes"}, "yes", {1, 1, 0}, 1)')).toBeCloseTo(1, 9);
  });
  it('=COUNTIFS({1, 2}, ">0", {1, 2, 3}, ">0")', async () => {
    expect(await evaluate('=COUNTIFS({1, 2}, ">0", {1, 2, 3}, ">0")')).toMatchObject({ code: '#VALUE!' });
  });
});
