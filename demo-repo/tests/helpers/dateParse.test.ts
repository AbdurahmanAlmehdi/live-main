import { describe, expect, it } from 'vitest';
import { parseDateText, parseTimeText } from '../../src/helpers/dateParse';

describe('parseDateText', () => {
  it('reads numeric forms', () => {
    expect(parseDateText('2020-01-15')).toBe(43845);
    expect(parseDateText('1/15/2020')).toBe(43845);
    expect(parseDateText('1/15/20')).toBe(43845);
  });

  it('reads month names', () => {
    expect(parseDateText('15-Jan-2020')).toBe(43845);
    expect(parseDateText('January 15, 2020')).toBe(43845);
    expect(parseDateText('15 jan 2020 10:30')).toBe(43845);
  });

  it('rejects invalid dates and other text', () => {
    expect(parseDateText('2020-02-30')).toMatchObject({ code: '#VALUE!' });
    expect(parseDateText('soon')).toMatchObject({ code: '#VALUE!' });
  });
});

describe('parseTimeText', () => {
  it('reads 24-hour and AM/PM times', () => {
    expect(parseTimeText('12:00')).toBe(0.5);
    expect(parseTimeText('6:00 PM')).toBe(0.75);
    expect(parseTimeText('12:30 am')).toBeCloseTo(0.020833333333333332, 14);
    expect(parseTimeText('2020-01-15 18:00:00')).toBe(0.75);
  });

  it('rejects invalid times', () => {
    expect(parseTimeText('25:00')).toMatchObject({ code: '#VALUE!' });
    expect(parseTimeText('13:00 PM')).toMatchObject({ code: '#VALUE!' });
    expect(parseTimeText('noon')).toMatchObject({ code: '#VALUE!' });
  });
});
