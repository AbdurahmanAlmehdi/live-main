// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('PEARSON', () => {
  it('=PEARSON({9, 7, 5, 3, 1}, {10, 6, 1, 5, 3})', async () => {
    expect(await evaluate('=PEARSON({9, 7, 5, 3, 1}, {10, 6, 1, 5, 3})')).toBeCloseTo(0.6993786061802354, 9);
  });
  it('=PEARSON({1, 2, 3}, {2, 4, 6})', async () => {
    expect(await evaluate('=PEARSON({1, 2, 3}, {2, 4, 6})')).toBeCloseTo(1, 9);
  });
  it('=PEARSON({1, TRUE, 3, 4}, {2, 5, 6, 9})', async () => {
    expect(await evaluate('=PEARSON({1, TRUE, 3, 4}, {2, 5, 6, 9})')).toBeCloseTo(0.9941916256019199, 9);
  });
  it('=PEARSON({2, 2}, {1, 3})', async () => {
    expect(await evaluate('=PEARSON({2, 2}, {1, 3})')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=PEARSON({1, 2}, {1})', async () => {
    expect(await evaluate('=PEARSON({1, 2}, {1})')).toMatchObject({ code: '#N/A' });
  });
});
