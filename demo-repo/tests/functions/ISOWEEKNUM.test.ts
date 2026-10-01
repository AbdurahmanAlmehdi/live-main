// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ISOWEEKNUM', () => {
  it('=ISOWEEKNUM(DATE(2020, 1, 1))', async () => {
    expect(await evaluate('=ISOWEEKNUM(DATE(2020, 1, 1))')).toBeCloseTo(1, 9);
  });
  it('=ISOWEEKNUM(DATE(2021, 1, 1))', async () => {
    expect(await evaluate('=ISOWEEKNUM(DATE(2021, 1, 1))')).toBeCloseTo(53, 7);
  });
  it('=ISOWEEKNUM(DATE(2021, 1, 4))', async () => {
    expect(await evaluate('=ISOWEEKNUM(DATE(2021, 1, 4))')).toBeCloseTo(1, 9);
  });
  it('=ISOWEEKNUM(DATE(2020, 12, 31))', async () => {
    expect(await evaluate('=ISOWEEKNUM(DATE(2020, 12, 31))')).toBeCloseTo(53, 7);
  });
  it('=ISOWEEKNUM(DATE(2015, 12, 31))', async () => {
    expect(await evaluate('=ISOWEEKNUM(DATE(2015, 12, 31))')).toBeCloseTo(53, 7);
  });
  it('=ISOWEEKNUM(43845)', async () => {
    expect(await evaluate('=ISOWEEKNUM(43845)')).toBeCloseTo(3, 8);
  });
  it('=ISOWEEKNUM(-1)', async () => {
    expect(await evaluate('=ISOWEEKNUM(-1)')).toMatchObject({ code: '#NUM!' });
  });
});
