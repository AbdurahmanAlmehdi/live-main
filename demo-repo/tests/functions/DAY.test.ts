// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DAY', () => {
  it('=DAY(43845)', async () => {
    expect(await evaluate('=DAY(43845)')).toBeCloseTo(15, 7);
  });
  it('=DAY(43861.75)', async () => {
    expect(await evaluate('=DAY(43861.75)')).toBeCloseTo(31, 7);
  });
  it('=DAY(DATE(2020, 2, 29))', async () => {
    expect(await evaluate('=DAY(DATE(2020, 2, 29))')).toBeCloseTo(29, 7);
  });
  it('=DAY(1)', async () => {
    expect(await evaluate('=DAY(1)')).toBeCloseTo(1, 9);
  });
  it('=DAY(-1)', async () => {
    expect(await evaluate('=DAY(-1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DAY("x")', async () => {
    expect(await evaluate('=DAY("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
