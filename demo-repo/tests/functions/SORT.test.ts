// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';
import { toMatrix } from '../../src/core/value';

describe('SORT', () => {
  it('=SORT({3; 1; 2})', async () => {
    expect(toMatrix(await evaluate('=SORT({3; 1; 2})'))).toEqual([[1], [2], [3]]);
  });
  it('=SORT({3; 1; 2}, 1, -1)', async () => {
    expect(toMatrix(await evaluate('=SORT({3; 1; 2}, 1, -1)'))).toEqual([[3], [2], [1]]);
  });
  it('=SORT({"b", 2; "a", 1; "c", 3}, 2)', async () => {
    expect(toMatrix(await evaluate('=SORT({"b", 2; "a", 1; "c", 3}, 2)'))).toEqual([['a', 1], ['b', 2], ['c', 3]]);
  });
  it('=SORT({"b"; "A"; "c"; 1; TRUE})', async () => {
    expect(toMatrix(await evaluate('=SORT({"b"; "A"; "c"; 1; TRUE})'))).toEqual([[1], ['A'], ['b'], ['c'], [true]]);
  });
  it('=SORT({3, 1, 2}, 1, 1, TRUE)', async () => {
    expect(toMatrix(await evaluate('=SORT({3, 1, 2}, 1, 1, TRUE)'))).toEqual([[1, 2, 3]]);
  });
  it('=SORT({1; 2}, 3)', async () => {
    expect(await evaluate('=SORT({1; 2}, 3)')).toMatchObject({ code: '#VALUE!' });
  });
  it('=SORT({1; 2}, 1, 2)', async () => {
    expect(await evaluate('=SORT({1; 2}, 1, 2)')).toMatchObject({ code: '#VALUE!' });
  });
});
