import { describe, expect, it } from 'vitest';
import { err } from '../../src/core/errors';
import { collectPairs } from '../../src/helpers/pairs';

describe('collectPairs', () => {
  it('pairs scalars', () => {
    expect(collectPairs(1, 2)).toEqual({ xs: [1], ys: [2] });
  });

  it('drops pairs with a non-number on either side', () => {
    expect(collectPairs('a', 2)).toEqual({ xs: [], ys: [] });
    expect(collectPairs(true, 2)).toEqual({ xs: [], ys: [] });
    expect(collectPairs(null, 2)).toEqual({ xs: [], ys: [] });
  });

  it('returns errors from either side', () => {
    expect(collectPairs(1, err.na)).toMatchObject({ code: '#N/A' });
  });
});
