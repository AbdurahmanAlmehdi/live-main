// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';
import { toMatrix } from '../../src/core/value';

describe('DROP', () => {
  it('=DROP({1, 2; 3, 4; 5, 6}, 1)', async () => {
    expect(toMatrix(await evaluate('=DROP({1, 2; 3, 4; 5, 6}, 1)'))).toEqual([[3, 4], [5, 6]]);
  });
  it('=DROP({1, 2; 3, 4; 5, 6}, -2)', async () => {
    expect(toMatrix(await evaluate('=DROP({1, 2; 3, 4; 5, 6}, -2)'))).toEqual([[1, 2]]);
  });
  it('=DROP({1, 2, 3; 4, 5, 6}, 0, 1)', async () => {
    expect(toMatrix(await evaluate('=DROP({1, 2, 3; 4, 5, 6}, 0, 1)'))).toEqual([[2, 3], [5, 6]]);
  });
  it('=DROP({1, 2, 3}, 0, -1)', async () => {
    expect(toMatrix(await evaluate('=DROP({1, 2, 3}, 0, -1)'))).toEqual([[1, 2]]);
  });
  it('=DROP({1, 2; 3, 4}, 2)', async () => {
    expect(await evaluate('=DROP({1, 2; 3, 4}, 2)')).toMatchObject({ code: '#VALUE!' });
  });
});
