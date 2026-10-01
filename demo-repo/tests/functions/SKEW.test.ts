// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SKEW', () => {
  it('=SKEW({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})', async () => {
    expect(await evaluate('=SKEW({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})')).toBeCloseTo(0.3595430714067974, 9);
  });
  it('=SKEW(1, 2, 3, 10)', async () => {
    expect(await evaluate('=SKEW(1, 2, 3, 10)')).toBeCloseTo(1.7636326148038879, 8);
  });
  it('=SKEW({1, "a", 2, 9})', async () => {
    expect(await evaluate('=SKEW({1, "a", 2, 9})')).toBeCloseTo(1.6300591617118863, 8);
  });
  it('=SKEW(1, 2)', async () => {
    expect(await evaluate('=SKEW(1, 2)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=SKEW(2, 2, 2)', async () => {
    expect(await evaluate('=SKEW(2, 2, 2)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=SKEW(1, #N/A, 3)', async () => {
    expect(await evaluate('=SKEW(1, #N/A, 3)')).toMatchObject({ code: '#N/A' });
  });
});
