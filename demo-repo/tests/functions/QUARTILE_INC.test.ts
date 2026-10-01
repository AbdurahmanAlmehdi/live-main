// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('QUARTILE.INC', () => {
  it('=QUARTILE.INC({1, 2, 4, 7, 8, 9, 10, 12}, 1)', async () => {
    expect(await evaluate('=QUARTILE.INC({1, 2, 4, 7, 8, 9, 10, 12}, 1)')).toBeCloseTo(3.5, 8);
  });
  it('=QUARTILE.INC({3, 4, 5, 2, 3, 4, 5, 6, 4, 7}, 3)', async () => {
    expect(await evaluate('=QUARTILE.INC({3, 4, 5, 2, 3, 4, 5, 6, 4, 7}, 3)')).toBeCloseTo(5, 8);
  });
  it('=QUARTILE.INC({1, 2, 3}, 0)', async () => {
    expect(await evaluate('=QUARTILE.INC({1, 2, 3}, 0)')).toBeCloseTo(1, 9);
  });
  it('=QUARTILE.INC({1, 2, 3}, 4)', async () => {
    expect(await evaluate('=QUARTILE.INC({1, 2, 3}, 4)')).toBeCloseTo(3, 8);
  });
  it('=QUARTILE.INC({1, 2, 3, 4}, 2.7)', async () => {
    expect(await evaluate('=QUARTILE.INC({1, 2, 3, 4}, 2.7)')).toBeCloseTo(2.5, 8);
  });
  it('=QUARTILE.INC({1, 2}, 5)', async () => {
    expect(await evaluate('=QUARTILE.INC({1, 2}, 5)')).toMatchObject({ code: '#NUM!' });
  });
  it('=QUARTILE.INC({1, 2}, -1)', async () => {
    expect(await evaluate('=QUARTILE.INC({1, 2}, -1)')).toMatchObject({ code: '#NUM!' });
  });
});
