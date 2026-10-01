// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('TIMEVALUE', () => {
  it('=TIMEVALUE("12:00")', async () => {
    expect(await evaluate('=TIMEVALUE("12:00")')).toBeCloseTo(0.5, 9);
  });
  it('=TIMEVALUE("6:35 PM")', async () => {
    expect(await evaluate('=TIMEVALUE("6:35 PM")')).toBeCloseTo(0.7743055555555556, 9);
  });
  it('=TIMEVALUE("18:35:15")', async () => {
    expect(await evaluate('=TIMEVALUE("18:35:15")')).toBeCloseTo(0.7744791666666667, 9);
  });
  it('=TIMEVALUE("2020-01-15 06:00")', async () => {
    expect(await evaluate('=TIMEVALUE("2020-01-15 06:00")')).toBeCloseTo(0.25, 9);
  });
  it('=TIMEVALUE("25:00")', async () => {
    expect(await evaluate('=TIMEVALUE("25:00")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=TIMEVALUE("noon")', async () => {
    expect(await evaluate('=TIMEVALUE("noon")')).toMatchObject({ code: '#VALUE!' });
  });
});
