// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('MAXIFS', () => {
  it('=MAXIFS({89, 93, 96, 85, 91, 88}, {1, 2, 2, 3, 1, 1}, 1)', async () => {
    expect(await evaluate('=MAXIFS({89, 93, 96, 85, 91, 88}, {1, 2, 2, 3, 1, 1}, 1)')).toBeCloseTo(91, 7);
  });
  it('=MAXIFS({10, 1, 100}, {"b", "a", "b"}, "b", {1, 1, 0}, 1)', async () => {
    expect(await evaluate('=MAXIFS({10, 1, 100}, {"b", "a", "b"}, "b", {1, 1, 0}, 1)')).toBeCloseTo(10, 8);
  });
  it('=MAXIFS({1, 2}, {"x", "y"}, "z")', async () => {
    expect(await evaluate('=MAXIFS({1, 2}, {"x", "y"}, "z")')).toBeCloseTo(0, 9);
  });
  it('=MAXIFS({-5, -2, -9}, {1, 1, 1}, 1)', async () => {
    expect(await evaluate('=MAXIFS({-5, -2, -9}, {1, 1, 1}, 1)')).toBeCloseTo(-2, 8);
  });
  it('=MAXIFS({1, 2, 3}, {1, 2}, ">0")', async () => {
    expect(await evaluate('=MAXIFS({1, 2, 3}, {1, 2}, ">0")')).toMatchObject({ code: '#VALUE!' });
  });
});
