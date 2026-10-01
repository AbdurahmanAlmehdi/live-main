import { describe, expect, it } from 'vitest';
import { err } from '../../src/core/errors';
import { collectHolidays, isWorkday } from '../../src/helpers/workdays';

describe('isWorkday', () => {
  it('excludes weekends', () => {
    expect(isWorkday(43845, new Set())).toBe(true); // Wednesday
    expect(isWorkday(43841, new Set())).toBe(false); // Saturday
    expect(isWorkday(43842, new Set())).toBe(false); // Sunday
  });

  it('excludes holidays', () => {
    expect(isWorkday(43845, new Set([43845]))).toBe(false);
    expect(isWorkday(43845.5, new Set([43845]))).toBe(false);
  });
});

describe('collectHolidays', () => {
  it('collects whole-day serials', () => {
    expect(collectHolidays(43845.7)).toEqual(new Set([43845]));
    expect(collectHolidays(undefined)).toEqual(new Set());
    expect(collectHolidays(null)).toEqual(new Set());
  });

  it('rejects text and passes errors through', () => {
    expect(collectHolidays('x')).toMatchObject({ code: '#VALUE!' });
    expect(collectHolidays(err.na)).toMatchObject({ code: '#N/A' });
  });
});
