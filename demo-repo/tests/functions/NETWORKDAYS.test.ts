// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('NETWORKDAYS', () => {
  it('=NETWORKDAYS(DATE(2020, 1, 1), DATE(2020, 1, 31))', async () => {
    expect(await evaluate('=NETWORKDAYS(DATE(2020, 1, 1), DATE(2020, 1, 31))')).toBeCloseTo(23, 7);
  });
  it('=NETWORKDAYS(DATE(2020, 1, 1), DATE(2020, 1, 31), {43845, 43846})', async () => {
    expect(await evaluate('=NETWORKDAYS(DATE(2020, 1, 1), DATE(2020, 1, 31), {43845, 43846})')).toBeCloseTo(21, 7);
  });
  it('=NETWORKDAYS(DATE(2020, 1, 31), DATE(2020, 1, 1))', async () => {
    expect(await evaluate('=NETWORKDAYS(DATE(2020, 1, 31), DATE(2020, 1, 1))')).toBeCloseTo(-23, 7);
  });
  it('=NETWORKDAYS(43841, 43842)', async () => {
    expect(await evaluate('=NETWORKDAYS(43841, 43842)')).toBeCloseTo(0, 9);
  });
  it('=NETWORKDAYS(43845, 43845)', async () => {
    expect(await evaluate('=NETWORKDAYS(43845, 43845)')).toBeCloseTo(1, 9);
  });
  it('=NETWORKDAYS("x", 1)', async () => {
    expect(await evaluate('=NETWORKDAYS("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
