// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SKEW.P', () => {
  it('=SKEW.P({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})', async () => {
    expect(await evaluate('=SKEW.P({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})')).toBeCloseTo(0.30319333935414394, 9);
  });
  it('=SKEW.P(1, 2, 3, 10)', async () => {
    expect(await evaluate('=SKEW.P(1, 2, 3, 10)')).toBeCloseTo(1.0182337649086284, 8);
  });
  it('=SKEW.P({1, "a", 2, 9})', async () => {
    expect(await evaluate('=SKEW.P({1, "a", 2, 9})')).toBeCloseTo(0.6654688661238354, 9);
  });
  it('=SKEW.P(1, 2)', async () => {
    expect(await evaluate('=SKEW.P(1, 2)')).toBeCloseTo(0, 9);
  });
  it('=SKEW.P(2, 2, 2)', async () => {
    expect(await evaluate('=SKEW.P(2, 2, 2)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=SKEW.P(1, #N/A, 3)', async () => {
    expect(await evaluate('=SKEW.P(1, #N/A, 3)')).toMatchObject({ code: '#N/A' });
  });
});
