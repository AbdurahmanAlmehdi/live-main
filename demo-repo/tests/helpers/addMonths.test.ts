import { describe, expect, it } from 'vitest';
import { addMonths, endOfMonth } from '../../src/helpers/addMonths';

describe('addMonths', () => {
  it('keeps the day of month', () => {
    expect(addMonths(43845, 1)).toBe(43876);
    expect(addMonths(43845, -1)).toBe(43814);
    expect(addMonths(43845, 12)).toBe(44211);
  });

  it('clamps to the end of shorter months', () => {
    expect(addMonths(43861, 1)).toBe(43890); // 2020-01-31 → 2020-02-29
  });

  it('rejects results before 1900', () => {
    expect(addMonths(10, -12)).toMatchObject({ code: '#NUM!' });
  });
});

describe('endOfMonth', () => {
  it('finds the last day of the month', () => {
    expect(endOfMonth(43845, 0)).toBe(43861);
    expect(endOfMonth(43845, 1)).toBe(43890);
    expect(endOfMonth(43845, -1)).toBe(43830);
  });
});
