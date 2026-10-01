// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';
import { toMatrix } from '../../src/core/value';

describe('TRANSPOSE', () => {
  it('=TRANSPOSE({1, 2, 3})', async () => {
    expect(toMatrix(await evaluate('=TRANSPOSE({1, 2, 3})'))).toEqual([[1], [2], [3]]);
  });
  it('=TRANSPOSE({1; 2})', async () => {
    expect(toMatrix(await evaluate('=TRANSPOSE({1; 2})'))).toEqual([[1, 2]]);
  });
  it('=TRANSPOSE({1, 2; 3, 4; 5, 6})', async () => {
    expect(toMatrix(await evaluate('=TRANSPOSE({1, 2; 3, 4; 5, 6})'))).toEqual([[1, 3, 5], [2, 4, 6]]);
  });
  it('=TRANSPOSE(7)', async () => {
    expect(toMatrix(await evaluate('=TRANSPOSE(7)'))).toEqual([[7]]);
  });
  it('=TRANSPOSE({"a", TRUE})', async () => {
    expect(toMatrix(await evaluate('=TRANSPOSE({"a", TRUE})'))).toEqual([['a'], [true]]);
  });
});
