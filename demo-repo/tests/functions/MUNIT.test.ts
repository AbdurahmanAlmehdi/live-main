// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';
import { toMatrix } from '../../src/core/value';

describe('MUNIT', () => {
  it('=MUNIT(1)', async () => {
    expect(toMatrix(await evaluate('=MUNIT(1)'))).toEqual([[1]]);
  });
  it('=MUNIT(2)', async () => {
    expect(toMatrix(await evaluate('=MUNIT(2)'))).toEqual([[1, 0], [0, 1]]);
  });
  it('=MUNIT(3)', async () => {
    expect(toMatrix(await evaluate('=MUNIT(3)'))).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  });
  it('=MUNIT(0)', async () => {
    expect(await evaluate('=MUNIT(0)')).toMatchObject({ code: '#VALUE!' });
  });
  it('=MUNIT("x")', async () => {
    expect(await evaluate('=MUNIT("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
