// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('WEEKNUM', () => {
  it('=WEEKNUM(DATE(2020, 1, 1))', async () => {
    expect(await evaluate('=WEEKNUM(DATE(2020, 1, 1))')).toBeCloseTo(1, 9);
  });
  it('=WEEKNUM(DATE(2020, 1, 5))', async () => {
    expect(await evaluate('=WEEKNUM(DATE(2020, 1, 5))')).toBeCloseTo(2, 8);
  });
  it('=WEEKNUM(DATE(2020, 1, 5), 2)', async () => {
    expect(await evaluate('=WEEKNUM(DATE(2020, 1, 5), 2)')).toBeCloseTo(1, 9);
  });
  it('=WEEKNUM(DATE(2020, 12, 31))', async () => {
    expect(await evaluate('=WEEKNUM(DATE(2020, 12, 31))')).toBeCloseTo(53, 7);
  });
  it('=WEEKNUM(DATE(2021, 3, 9), 11)', async () => {
    expect(await evaluate('=WEEKNUM(DATE(2021, 3, 9), 11)')).toBeCloseTo(11, 7);
  });
  it('=WEEKNUM(DATE(2021, 3, 9), 17)', async () => {
    expect(await evaluate('=WEEKNUM(DATE(2021, 3, 9), 17)')).toBeCloseTo(11, 7);
  });
  it('=WEEKNUM(43845, 5)', async () => {
    expect(await evaluate('=WEEKNUM(43845, 5)')).toMatchObject({ code: '#NUM!' });
  });
});
