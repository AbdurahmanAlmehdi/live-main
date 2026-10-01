// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('NETWORKDAYS.INTL', () => {
  it('=NETWORKDAYS.INTL(DATE(2020, 1, 1), DATE(2020, 1, 31))', async () => {
    expect(await evaluate('=NETWORKDAYS.INTL(DATE(2020, 1, 1), DATE(2020, 1, 31))')).toBeCloseTo(23, 7);
  });
  it('=NETWORKDAYS.INTL(DATE(2020, 1, 1), DATE(2020, 1, 31), 7)', async () => {
    expect(await evaluate('=NETWORKDAYS.INTL(DATE(2020, 1, 1), DATE(2020, 1, 31), 7)')).toBeCloseTo(22, 7);
  });
  it('=NETWORKDAYS.INTL(DATE(2020, 1, 1), DATE(2020, 1, 31), 11)', async () => {
    expect(await evaluate('=NETWORKDAYS.INTL(DATE(2020, 1, 1), DATE(2020, 1, 31), 11)')).toBeCloseTo(27, 7);
  });
  it('=NETWORKDAYS.INTL(DATE(2020, 1, 1), DATE(2020, 1, 31), "0000110")', async () => {
    expect(await evaluate('=NETWORKDAYS.INTL(DATE(2020, 1, 1), DATE(2020, 1, 31), "0000110")')).toBeCloseTo(22, 7);
  });
  it('=NETWORKDAYS.INTL(DATE(2020, 1, 1), DATE(2020, 1, 31), 1, {43845})', async () => {
    expect(await evaluate('=NETWORKDAYS.INTL(DATE(2020, 1, 1), DATE(2020, 1, 31), 1, {43845})')).toBeCloseTo(22, 7);
  });
  it('=NETWORKDAYS.INTL(DATE(2020, 1, 31), DATE(2020, 1, 1), 1)', async () => {
    expect(await evaluate('=NETWORKDAYS.INTL(DATE(2020, 1, 31), DATE(2020, 1, 1), 1)')).toBeCloseTo(-23, 7);
  });
  it('=NETWORKDAYS.INTL(43845, 43850, 99)', async () => {
    expect(await evaluate('=NETWORKDAYS.INTL(43845, 43850, 99)')).toMatchObject({ code: '#NUM!' });
  });
});
