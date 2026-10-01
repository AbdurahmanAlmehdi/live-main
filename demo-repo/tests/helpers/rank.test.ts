import { describe, expect, it } from 'vitest';
import { rankOf } from '../../src/helpers/rank';

describe('rankOf', () => {
  const values = [7, 3.5, 3.5, 1, 2];

  it('ranks descending by default', () => {
    expect(rankOf(7, values, false)).toBe(1);
    expect(rankOf(2, values, false)).toBe(4);
  });

  it('ranks ascending', () => {
    expect(rankOf(1, values, true)).toBe(1);
    expect(rankOf(7, values, true)).toBe(5);
  });

  it('gives ties the best rank', () => {
    expect(rankOf(3.5, values, false)).toBe(2);
    expect(rankOf(3.5, values, true)).toBe(3);
  });

  it('returns #N/A for a value not in the list', () => {
    expect(rankOf(4, values, false)).toMatchObject({ code: '#N/A' });
  });
});
