// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';
import { toMatrix } from '../../src/core/value';

describe('CHOOSEROWS', () => {
  it('=CHOOSEROWS({1, 2; 3, 4; 5, 6}, 1, 3)', async () => {
    expect(toMatrix(await evaluate('=CHOOSEROWS({1, 2; 3, 4; 5, 6}, 1, 3)'))).toEqual([[1, 2], [5, 6]]);
  });
  it('=CHOOSEROWS({1, 2; 3, 4; 5, 6}, -1)', async () => {
    expect(toMatrix(await evaluate('=CHOOSEROWS({1, 2; 3, 4; 5, 6}, -1)'))).toEqual([[5, 6]]);
  });
  it('=CHOOSEROWS({1; 2; 3}, 2, 2)', async () => {
    expect(toMatrix(await evaluate('=CHOOSEROWS({1; 2; 3}, 2, 2)'))).toEqual([[2], [2]]);
  });
  it('=CHOOSEROWS({1; 2}, 3)', async () => {
    expect(await evaluate('=CHOOSEROWS({1; 2}, 3)')).toMatchObject({ code: '#VALUE!' });
  });
  it('=CHOOSEROWS({1; 2}, 0)', async () => {
    expect(await evaluate('=CHOOSEROWS({1; 2}, 0)')).toMatchObject({ code: '#VALUE!' });
  });
});
