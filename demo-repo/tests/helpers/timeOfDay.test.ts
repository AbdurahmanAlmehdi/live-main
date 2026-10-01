import { describe, expect, it } from 'vitest';
import { serialFromTime, timeFromSerial } from '../../src/helpers/timeOfDay';

describe('timeFromSerial', () => {
  it('splits the fraction of a day', () => {
    expect(timeFromSerial(0.5)).toEqual({ hour: 12, minute: 0, second: 0 });
    expect(timeFromSerial(43845.75)).toEqual({ hour: 18, minute: 0, second: 0 });
    expect(timeFromSerial(0.0006944444444444445)).toEqual({ hour: 0, minute: 1, second: 0 });
  });

  it('rounds to the nearest second', () => {
    expect(timeFromSerial(0.999999999)).toEqual({ hour: 0, minute: 0, second: 0 });
  });

  it('rejects negative serials', () => {
    expect(timeFromSerial(-0.5)).toMatchObject({ code: '#NUM!' });
  });
});

describe('serialFromTime', () => {
  it('builds fractions of a day with overflow', () => {
    expect(serialFromTime(12, 0, 0)).toBe(0.5);
    expect(serialFromTime(0, 90, 0)).toBeCloseTo(0.0625, 14);
    expect(serialFromTime(25, 0, 0)).toBeCloseTo(1 / 24, 14);
  });

  it('rejects negative totals', () => {
    expect(serialFromTime(0, -1, 0)).toMatchObject({ code: '#NUM!' });
  });
});
