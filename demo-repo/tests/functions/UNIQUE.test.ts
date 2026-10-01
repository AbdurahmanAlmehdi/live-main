// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';
import { toMatrix } from '../../src/core/value';

describe('UNIQUE', () => {
  it('=UNIQUE({1; 2; 2; 3; 1})', async () => {
    expect(toMatrix(await evaluate('=UNIQUE({1; 2; 2; 3; 1})'))).toEqual([[1], [2], [3]]);
  });
  it('=UNIQUE({"a"; "A"; "b"})', async () => {
    expect(toMatrix(await evaluate('=UNIQUE({"a"; "A"; "b"})'))).toEqual([['a'], ['b']]);
  });
  it('=UNIQUE({1, 1; 2, 2; 1, 1})', async () => {
    expect(toMatrix(await evaluate('=UNIQUE({1, 1; 2, 2; 1, 1})'))).toEqual([[1, 1], [2, 2]]);
  });
  it('=UNIQUE({1, 2, 1}, TRUE)', async () => {
    expect(toMatrix(await evaluate('=UNIQUE({1, 2, 1}, TRUE)'))).toEqual([[1, 2]]);
  });
  it('=UNIQUE({1; 2; 2; 3}, FALSE, TRUE)', async () => {
    expect(toMatrix(await evaluate('=UNIQUE({1; 2; 2; 3}, FALSE, TRUE)'))).toEqual([[1], [3]]);
  });
  it('=UNIQUE({1; 1}, FALSE, TRUE)', async () => {
    expect(await evaluate('=UNIQUE({1; 1}, FALSE, TRUE)')).toMatchObject({ code: '#VALUE!' });
  });
});
