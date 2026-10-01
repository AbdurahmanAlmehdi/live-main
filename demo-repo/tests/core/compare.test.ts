import { describe, expect, it } from 'vitest';
import { compareScalars, scalarsEqual } from '../../src/core/compare';

describe('compareScalars', () => {
  it('orders numbers < text < booleans', () => {
    expect(compareScalars(100, 'a')).toBe(-1);
    expect(compareScalars('zzz', false)).toBe(-1);
    expect(compareScalars(true, false)).toBe(1);
  });

  it('compares text case-insensitively', () => {
    expect(compareScalars('abc', 'ABC')).toBe(0);
    expect(compareScalars('a', 'B')).toBe(-1);
  });

  it('treats empty as 0, "" or FALSE', () => {
    expect(scalarsEqual(null, 0)).toBe(true);
    expect(scalarsEqual(null, '')).toBe(true);
    expect(scalarsEqual(null, false)).toBe(true);
    expect(compareScalars(null, 1)).toBe(-1);
    expect(scalarsEqual(null, null)).toBe(true);
  });
});
