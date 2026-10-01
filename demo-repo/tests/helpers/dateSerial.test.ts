import { describe, expect, it } from 'vitest';
import { dateFromSerial, daysInMonth, serialFromDate } from '../../src/helpers/dateSerial';

describe('serialFromDate', () => {
  it('converts calendar dates', () => {
    expect(serialFromDate(1900, 1, 1)).toBe(1);
    expect(serialFromDate(1900, 3, 1)).toBe(61);
    expect(serialFromDate(2020, 1, 15)).toBe(43845);
  });

  it('normalises overflowing months and days', () => {
    expect(serialFromDate(2019, 13, 15)).toBe(43845);
    expect(serialFromDate(2020, 2, 0)).toBe(43861);
    expect(serialFromDate(2020, 1, 46)).toBe(43876);
  });

  it('adds 1900 to small years and rejects out-of-range years', () => {
    expect(serialFromDate(120, 1, 15)).toBe(43845);
    expect(serialFromDate(-1, 1, 1)).toMatchObject({ code: '#NUM!' });
    expect(serialFromDate(10000, 1, 1)).toMatchObject({ code: '#NUM!' });
  });
});

describe('dateFromSerial', () => {
  it('converts serials, including the fictional 1900-02-29', () => {
    expect(dateFromSerial(43845)).toEqual({ year: 2020, month: 1, day: 15 });
    expect(dateFromSerial(43845.75)).toEqual({ year: 2020, month: 1, day: 15 });
    expect(dateFromSerial(60)).toEqual({ year: 1900, month: 2, day: 29 });
    expect(dateFromSerial(61)).toEqual({ year: 1900, month: 3, day: 1 });
    expect(dateFromSerial(1)).toEqual({ year: 1900, month: 1, day: 1 });
  });

  it('rejects negative serials', () => {
    expect(dateFromSerial(-1)).toMatchObject({ code: '#NUM!' });
  });
});

describe('daysInMonth', () => {
  it('knows leap years', () => {
    expect(daysInMonth(2020, 2)).toBe(29);
    expect(daysInMonth(2021, 2)).toBe(28);
    expect(daysInMonth(2021, 12)).toBe(31);
  });
});
