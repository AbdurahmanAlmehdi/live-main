// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('FORECAST', () => {
  it('=FORECAST(30, {6, 7, 9, 15, 21}, {20, 28, 31, 38, 40})', async () => {
    expect(await evaluate('=FORECAST(30, {6, 7, 9, 15, 21}, {20, 28, 31, 38, 40})')).toBeCloseTo(10.607253086419755, 7);
  });
  it('=FORECAST(4, {2, 4, 6}, {1, 2, 3})', async () => {
    expect(await evaluate('=FORECAST(4, {2, 4, 6}, {1, 2, 3})')).toBeCloseTo(8, 8);
  });
  it('=FORECAST(0, {1, "a", 3, 4}, {2, 5, 6, 9})', async () => {
    expect(await evaluate('=FORECAST(0, {1, "a", 3, 4}, {2, 5, 6, 9})')).toBeCloseTo(0.21621621621621623, 9);
  });
  it('=FORECAST(1, {1, 2}, {3, 3})', async () => {
    expect(await evaluate('=FORECAST(1, {1, 2}, {3, 3})')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=FORECAST("x", {1, 2}, {1, 2})', async () => {
    expect(await evaluate('=FORECAST("x", {1, 2}, {1, 2})')).toMatchObject({ code: '#VALUE!' });
  });
});
