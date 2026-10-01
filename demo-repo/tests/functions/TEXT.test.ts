// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('TEXT', () => {
  it('=TEXT(1234.567, "$#,##0.00")', async () => {
    expect(await evaluate('=TEXT(1234.567, "$#,##0.00")')).toBe('$1,234.57');
  });
  it('=TEXT(0.285, "0.0%")', async () => {
    expect(await evaluate('=TEXT(0.285, "0.0%")')).toBe('28.5%');
  });
  it('=TEXT(43845, "yyyy-mm-dd")', async () => {
    expect(await evaluate('=TEXT(43845, "yyyy-mm-dd")')).toBe('2020-01-15');
  });
  it('=TEXT(43845, "dddd, mmmm d")', async () => {
    expect(await evaluate('=TEXT(43845, "dddd, mmmm d")')).toBe('Wednesday, January 15');
  });
  it('=TEXT(0.75, "h:mm AM/PM")', async () => {
    expect(await evaluate('=TEXT(0.75, "h:mm AM/PM")')).toBe('6:00 PM');
  });
  it('=TEXT(-5, "0.00;(0.00)")', async () => {
    expect(await evaluate('=TEXT(-5, "0.00;(0.00)")')).toBe('(5.00)');
  });
  it('=TEXT(12345.678, "0.00E+00")', async () => {
    expect(await evaluate('=TEXT(12345.678, "0.00E+00")')).toBe('1.23E+04');
  });
  it('=TEXT(7, "000")', async () => {
    expect(await evaluate('=TEXT(7, "000")')).toBe('007');
  });
  it('=TEXT("abc", "0.00")', async () => {
    expect(await evaluate('=TEXT("abc", "0.00")')).toBe('abc');
  });
  it('=TEXT(1234.5, "General")', async () => {
    expect(await evaluate('=TEXT(1234.5, "General")')).toBe('1234.5');
  });
});
