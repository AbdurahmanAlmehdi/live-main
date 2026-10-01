// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DAYS360', () => {
  it('=DAYS360(DATE(2020, 1, 1), DATE(2021, 1, 1))', async () => {
    expect(await evaluate('=DAYS360(DATE(2020, 1, 1), DATE(2021, 1, 1))')).toBeCloseTo(360, 6);
  });
  it('=DAYS360(43861, DATE(2020, 3, 31))', async () => {
    expect(await evaluate('=DAYS360(43861, DATE(2020, 3, 31))')).toBeCloseTo(60, 7);
  });
  it('=DAYS360(43890, DATE(2020, 3, 31))', async () => {
    expect(await evaluate('=DAYS360(43890, DATE(2020, 3, 31))')).toBeCloseTo(30, 7);
  });
  it('=DAYS360(43890, DATE(2020, 3, 31), TRUE)', async () => {
    expect(await evaluate('=DAYS360(43890, DATE(2020, 3, 31), TRUE)')).toBeCloseTo(31, 7);
  });
  it('=DAYS360(DATE(2020, 1, 30), DATE(2020, 3, 31))', async () => {
    expect(await evaluate('=DAYS360(DATE(2020, 1, 30), DATE(2020, 3, 31))')).toBeCloseTo(60, 7);
  });
  it('=DAYS360(44197, 43845)', async () => {
    expect(await evaluate('=DAYS360(44197, 43845)')).toBeCloseTo(-346, 6);
  });
  it('=DAYS360("x", 1)', async () => {
    expect(await evaluate('=DAYS360("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
