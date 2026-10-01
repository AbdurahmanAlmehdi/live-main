// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('COVARIANCE.P', () => {
  it('=COVARIANCE.P({3, 2, 4, 5, 6}, {9, 7, 12, 15, 17})', async () => {
    expect(await evaluate('=COVARIANCE.P({3, 2, 4, 5, 6}, {9, 7, 12, 15, 17})')).toBeCloseTo(5.2, 8);
  });
  it('=COVARIANCE.P({1, 2, 3}, {3, 2, 1})', async () => {
    expect(await evaluate('=COVARIANCE.P({1, 2, 3}, {3, 2, 1})')).toBeCloseTo(-0.6666666666666666, 9);
  });
  it('=COVARIANCE.P({1, "a", 3, 4}, {2, 5, 6, 9})', async () => {
    expect(await evaluate('=COVARIANCE.P({1, "a", 3, 4}, {2, 5, 6, 9})')).toBeCloseTo(3.5555555555555554, 8);
  });
  it('=COVARIANCE.P(1, 2)', async () => {
    expect(await evaluate('=COVARIANCE.P(1, 2)')).toBeCloseTo(0, 9);
  });
  it('=COVARIANCE.P({1, 2}, {1})', async () => {
    expect(await evaluate('=COVARIANCE.P({1, 2}, {1})')).toMatchObject({ code: '#N/A' });
  });
});
