// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SUMPRODUCT', () => {
  it('=SUMPRODUCT({1, 2, 3}, {4, 5, 6})', async () => {
    expect(await evaluate('=SUMPRODUCT({1, 2, 3}, {4, 5, 6})')).toBeCloseTo(32, 7);
  });
  it('=SUMPRODUCT({1, 2; 3, 4}, {5, 6; 7, 8})', async () => {
    expect(await evaluate('=SUMPRODUCT({1, 2; 3, 4}, {5, 6; 7, 8})')).toBeCloseTo(70, 7);
  });
  it('=SUMPRODUCT({1, 2, 3})', async () => {
    expect(await evaluate('=SUMPRODUCT({1, 2, 3})')).toBeCloseTo(6, 8);
  });
  it('=SUMPRODUCT({1, "a", 3}, {4, 5, 6})', async () => {
    expect(await evaluate('=SUMPRODUCT({1, "a", 3}, {4, 5, 6})')).toBeCloseTo(22, 7);
  });
  it('=SUMPRODUCT({1, 2}, {1, 2}, {3, 4})', async () => {
    expect(await evaluate('=SUMPRODUCT({1, 2}, {1, 2}, {3, 4})')).toBeCloseTo(19, 7);
  });
  it('=SUMPRODUCT({1, 2}, {1, 2, 3})', async () => {
    expect(await evaluate('=SUMPRODUCT({1, 2}, {1, 2, 3})')).toMatchObject({ code: '#VALUE!' });
  });
});
