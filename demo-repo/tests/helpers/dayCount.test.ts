import { describe, expect, it } from 'vitest';
import { days360, yearFraction } from '../../src/helpers/dayCount';

// serials: 2020-01-31 = 43861, 2020-02-29 = 43890, 2020-03-31 = 43921, 2021-01-01 = 44197, 2020-01-01 = 43831
describe('days360', () => {
  it('US method', () => {
    expect(days360(43831, 44197, false)).toBe(360);
    expect(days360(43861, 43921, false)).toBe(60);
    expect(days360(43890, 43921, false)).toBe(30);
  });

  it('European method', () => {
    expect(days360(43861, 43921, true)).toBe(60);
    expect(days360(43890, 43921, true)).toBe(31);
  });
});

describe('yearFraction', () => {
  it('supports every basis', () => {
    expect(yearFraction(43831, 44197, 0)).toBe(1);
    expect(yearFraction(43831, 44197, 1)).toBe(1);
    expect(yearFraction(43831, 44012, 2)).toBeCloseTo(181 / 360, 14);
    expect(yearFraction(43831, 44012, 3)).toBeCloseTo(181 / 365, 14);
    expect(yearFraction(43861, 43921, 4)).toBeCloseTo(60 / 360, 14);
  });

  it('ignores the order of the dates and rejects unknown bases', () => {
    expect(yearFraction(44197, 43831, 0)).toBe(1);
    expect(yearFraction(43831, 44197, 5)).toMatchObject({ code: '#NUM!' });
  });
});
