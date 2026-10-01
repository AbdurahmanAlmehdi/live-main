import { describe, expect, it } from 'vitest';
import { findExact } from '../../src/helpers/lookupExact';

describe('findExact', () => {
  const cells = [1, '1', 'Apple', true, 'banana', 2];

  it('finds values of the same type', () => {
    expect(findExact(1, cells)).toBe(0);
    expect(findExact('1', cells)).toBe(1);
    expect(findExact(true, cells)).toBe(3);
    expect(findExact(2, cells)).toBe(5);
  });

  it('matches text case-insensitively', () => {
    expect(findExact('apple', cells)).toBe(2);
  });

  it('supports wildcards in text needles', () => {
    expect(findExact('b*', cells)).toBe(4);
    expect(findExact('?pple', cells)).toBe(2);
  });

  it('returns -1 when missing', () => {
    expect(findExact(3, cells)).toBe(-1);
    expect(findExact('cherry', cells)).toBe(-1);
  });
});
