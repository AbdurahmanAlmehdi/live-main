// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('MINIFS', () => {
  it('=MINIFS({89, 93, 96, 85, 91, 88}, {1, 2, 2, 3, 1, 1}, 1)', async () => {
    expect(await evaluate('=MINIFS({89, 93, 96, 85, 91, 88}, {1, 2, 2, 3, 1, 1}, 1)')).toBeCloseTo(88, 7);
  });
  it('=MINIFS({10, 1, 100}, {"b", "a", "b"}, "b")', async () => {
    expect(await evaluate('=MINIFS({10, 1, 100}, {"b", "a", "b"}, "b")')).toBeCloseTo(10, 8);
  });
  it('=MINIFS({1, 2}, {"x", "y"}, "z")', async () => {
    expect(await evaluate('=MINIFS({1, 2}, {"x", "y"}, "z")')).toBeCloseTo(0, 9);
  });
  it('=MINIFS({5, 2, 9}, {1, 1, 0}, 1)', async () => {
    expect(await evaluate('=MINIFS({5, 2, 9}, {1, 1, 0}, 1)')).toBeCloseTo(2, 8);
  });
  it('=MINIFS({1, 2, 3}, {1, 2}, ">0")', async () => {
    expect(await evaluate('=MINIFS({1, 2, 3}, {1, 2}, ">0")')).toMatchObject({ code: '#VALUE!' });
  });
});
