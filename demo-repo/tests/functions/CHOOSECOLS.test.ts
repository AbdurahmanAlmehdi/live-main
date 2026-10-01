// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';
import { toMatrix } from '../../src/core/value';

describe('CHOOSECOLS', () => {
  it('=CHOOSECOLS({1, 2, 3; 4, 5, 6}, 1, 3)', async () => {
    expect(toMatrix(await evaluate('=CHOOSECOLS({1, 2, 3; 4, 5, 6}, 1, 3)'))).toEqual([[1, 3], [4, 6]]);
  });
  it('=CHOOSECOLS({1, 2, 3; 4, 5, 6}, -1)', async () => {
    expect(toMatrix(await evaluate('=CHOOSECOLS({1, 2, 3; 4, 5, 6}, -1)'))).toEqual([[3], [6]]);
  });
  it('=CHOOSECOLS({1, 2, 3}, 2, 2)', async () => {
    expect(toMatrix(await evaluate('=CHOOSECOLS({1, 2, 3}, 2, 2)'))).toEqual([[2, 2]]);
  });
  it('=CHOOSECOLS({1, 2}, 3)', async () => {
    expect(await evaluate('=CHOOSECOLS({1, 2}, 3)')).toMatchObject({ code: '#VALUE!' });
  });
  it('=CHOOSECOLS({1, 2}, 0)', async () => {
    expect(await evaluate('=CHOOSECOLS({1, 2}, 0)')).toMatchObject({ code: '#VALUE!' });
  });
});
