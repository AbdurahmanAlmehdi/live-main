// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';
import { toMatrix } from '../../src/core/value';

describe('TAKE', () => {
  it('=TAKE({1, 2; 3, 4; 5, 6}, 2)', async () => {
    expect(toMatrix(await evaluate('=TAKE({1, 2; 3, 4; 5, 6}, 2)'))).toEqual([[1, 2], [3, 4]]);
  });
  it('=TAKE({1, 2; 3, 4; 5, 6}, -1)', async () => {
    expect(toMatrix(await evaluate('=TAKE({1, 2; 3, 4; 5, 6}, -1)'))).toEqual([[5, 6]]);
  });
  it('=TAKE({1, 2, 3; 4, 5, 6}, 2, 2)', async () => {
    expect(toMatrix(await evaluate('=TAKE({1, 2, 3; 4, 5, 6}, 2, 2)'))).toEqual([[1, 2], [4, 5]]);
  });
  it('=TAKE({1, 2, 3}, 1, -2)', async () => {
    expect(toMatrix(await evaluate('=TAKE({1, 2, 3}, 1, -2)'))).toEqual([[2, 3]]);
  });
  it('=TAKE({1, 2; 3, 4}, 5)', async () => {
    expect(toMatrix(await evaluate('=TAKE({1, 2; 3, 4}, 5)'))).toEqual([[1, 2], [3, 4]]);
  });
  it('=TAKE({1, 2; 3, 4}, 0)', async () => {
    expect(await evaluate('=TAKE({1, 2; 3, 4}, 0)')).toMatchObject({ code: '#VALUE!' });
  });
});
