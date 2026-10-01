// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';
import { toMatrix } from '../../src/core/value';

describe('HSTACK', () => {
  it('=HSTACK({1; 2}, {3; 4})', async () => {
    expect(toMatrix(await evaluate('=HSTACK({1; 2}, {3; 4})'))).toEqual([[1, 3], [2, 4]]);
  });
  it('=HSTACK(1, 2, 3)', async () => {
    expect(toMatrix(await evaluate('=HSTACK(1, 2, 3)'))).toEqual([[1, 2, 3]]);
  });
  it('=HSTACK({1, 2}, {3, 4})', async () => {
    expect(toMatrix(await evaluate('=HSTACK({1, 2}, {3, 4})'))).toEqual([[1, 2, 3, 4]]);
  });
  it('=HSTACK({1; 2}, 3)', async () => {
    const m = toMatrix(await evaluate('=HSTACK({1; 2}, 3)'));
    expect(m.map((row) => row.length)).toEqual([2,2]);
    expect(m[0][0]).toBeCloseTo(1, 9);
    expect(m[0][1]).toBeCloseTo(3, 8);
    expect(m[1][0]).toBeCloseTo(2, 8);
    expect(m[1][1]).toMatchObject({ code: '#N/A' });
  });
});
