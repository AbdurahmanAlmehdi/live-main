// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';
import { toMatrix } from '../../src/core/value';

describe('MMULT', () => {
  it('=MMULT({1, 2; 3, 4}, {5, 6; 7, 8})', async () => {
    expect(toMatrix(await evaluate('=MMULT({1, 2; 3, 4}, {5, 6; 7, 8})'))).toEqual([[19, 22], [43, 50]]);
  });
  it('=MMULT({1, 2, 3}, {4; 5; 6})', async () => {
    expect(toMatrix(await evaluate('=MMULT({1, 2, 3}, {4; 5; 6})'))).toEqual([[32]]);
  });
  it('=MMULT({1; 2}, {3, 4})', async () => {
    expect(toMatrix(await evaluate('=MMULT({1; 2}, {3, 4})'))).toEqual([[3, 4], [6, 8]]);
  });
  it('=MMULT({0.5, 1.5}, {2; 4})', async () => {
    expect(toMatrix(await evaluate('=MMULT({0.5, 1.5}, {2; 4})'))).toEqual([[7]]);
  });
  it('=MMULT({1, 2}, {1, 2})', async () => {
    expect(await evaluate('=MMULT({1, 2}, {1, 2})')).toMatchObject({ code: '#VALUE!' });
  });
  it('=MMULT({1, "a"}, {1; 2})', async () => {
    expect(await evaluate('=MMULT({1, "a"}, {1; 2})')).toMatchObject({ code: '#VALUE!' });
  });
});
