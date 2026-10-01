// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('STEYX', () => {
  it('=STEYX({2, 3, 9, 1, 8, 7, 5}, {6, 5, 11, 7, 5, 4, 4})', async () => {
    expect(await evaluate('=STEYX({2, 3, 9, 1, 8, 7, 5}, {6, 5, 11, 7, 5, 4, 4})')).toBeCloseTo(3.305718950210041, 8);
  });
  it('=STEYX({1, 3, 2, 5}, {1, 2, 3, 4})', async () => {
    expect(await evaluate('=STEYX({1, 3, 2, 5}, {1, 2, 3, 4})')).toBeCloseTo(1.161895003862225, 8);
  });
  it('=STEYX({1, "a", 3, 4, 7}, {2, 5, 6, 9, 1})', async () => {
    expect(await evaluate('=STEYX({1, "a", 3, 4, 7}, {2, 5, 6, 9, 1})')).toBeCloseTo(3.021266088991138, 8);
  });
  it('=STEYX({1, 2}, {1, 2})', async () => {
    expect(await evaluate('=STEYX({1, 2}, {1, 2})')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=STEYX({1, 2}, {1})', async () => {
    expect(await evaluate('=STEYX({1, 2}, {1})')).toMatchObject({ code: '#N/A' });
  });
});
