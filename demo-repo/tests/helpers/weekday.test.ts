import { describe, expect, it } from 'vitest';
import { dayOfWeek, weekOfYear, weekdayOf } from '../../src/helpers/weekday';

describe('weekday', () => {
  it('dayOfWeek (0 = Sunday)', () => {
    expect(dayOfWeek(43845)).toBe(3); // 2020-01-15, a Wednesday
    expect(dayOfWeek(43842)).toBe(0);
  });

  it('weekdayOf supports the return types', () => {
    expect(weekdayOf(43845, 1)).toBe(4);
    expect(weekdayOf(43845, 2)).toBe(3);
    expect(weekdayOf(43845, 3)).toBe(2);
    expect(weekdayOf(43845, 16)).toBe(5);
    expect(weekdayOf(43845, 4)).toMatchObject({ code: '#NUM!' });
  });

  it('weekOfYear counts weeks from the one containing Jan 1', () => {
    expect(weekOfYear(43831, 0)).toBe(1); // 2020-01-01
    expect(weekOfYear(43835, 0)).toBe(2); // 2020-01-05, a Sunday
    expect(weekOfYear(43835, 1)).toBe(1);
    expect(weekOfYear(44196, 0)).toBe(53); // 2020-12-31
  });
});
