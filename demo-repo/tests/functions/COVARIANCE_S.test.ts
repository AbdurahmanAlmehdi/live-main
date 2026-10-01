// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('COVARIANCE.S', () => {
  it('=COVARIANCE.S({2, 4, 8}, {5, 11, 12})', async () => {
    expect(await evaluate('=COVARIANCE.S({2, 4, 8}, {5, 11, 12})')).toBeCloseTo(9.666666666666668, 8);
  });
  it('=COVARIANCE.S({1, 2, 3}, {3, 2, 1})', async () => {
    expect(await evaluate('=COVARIANCE.S({1, 2, 3}, {3, 2, 1})')).toBeCloseTo(-1, 9);
  });
  it('=COVARIANCE.S({1, "a", 3, 4}, {2, 5, 6, 9})', async () => {
    expect(await evaluate('=COVARIANCE.S({1, "a", 3, 4}, {2, 5, 6, 9})')).toBeCloseTo(5.333333333333333, 8);
  });
  it('=COVARIANCE.S(1, 2)', async () => {
    expect(await evaluate('=COVARIANCE.S(1, 2)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=COVARIANCE.S({1, 2}, {1})', async () => {
    expect(await evaluate('=COVARIANCE.S({1, 2}, {1})')).toMatchObject({ code: '#N/A' });
  });
});
