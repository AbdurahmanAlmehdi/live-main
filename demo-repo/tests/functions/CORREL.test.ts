// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('CORREL', () => {
  it('=CORREL({3, 2, 4, 5, 6}, {9, 7, 12, 15, 17})', async () => {
    expect(await evaluate('=CORREL({3, 2, 4, 5, 6}, {9, 7, 12, 15, 17})')).toBeCloseTo(0.9970544855015815, 9);
  });
  it('=CORREL({1, 2, 3}, {3, 2, 1})', async () => {
    expect(await evaluate('=CORREL({1, 2, 3}, {3, 2, 1})')).toBeCloseTo(-1, 9);
  });
  it('=CORREL({1, "a", 3, 4}, {2, 5, 6, 9})', async () => {
    expect(await evaluate('=CORREL({1, "a", 3, 4}, {2, 5, 6, 9})')).toBeCloseTo(0.9941916256019199, 9);
  });
  it('=CORREL({1, 1, 1}, {1, 2, 3})', async () => {
    expect(await evaluate('=CORREL({1, 1, 1}, {1, 2, 3})')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=CORREL({1, 2}, {1, 2, 3})', async () => {
    expect(await evaluate('=CORREL({1, 2}, {1, 2, 3})')).toMatchObject({ code: '#N/A' });
  });
});
