import { describe, expect, it } from 'vitest';
import { hasWildcards, wildcardToRegExp } from '../../src/helpers/wildcard';

describe('wildcards', () => {
  it('detects unescaped wildcards', () => {
    expect(hasWildcards('a*')).toBe(true);
    expect(hasWildcards('a?c')).toBe(true);
    expect(hasWildcards('a~*')).toBe(false);
    expect(hasWildcards('plain')).toBe(false);
  });

  it('matches whole texts, case-insensitively', () => {
    const re = wildcardToRegExp('ap*');
    expect(re.test('Apple')).toBe(true);
    expect(re.test('pineapple')).toBe(false);
    expect(wildcardToRegExp('b?d').test('BAD')).toBe(true);
    expect(wildcardToRegExp('b?d').test('bread')).toBe(false);
  });

  it('treats escaped and regex characters literally', () => {
    expect(wildcardToRegExp('5~*').test('5*')).toBe(true);
    expect(wildcardToRegExp('5~*').test('55')).toBe(false);
    expect(wildcardToRegExp('a.b(c)').test('a.b(c)')).toBe(true);
    expect(wildcardToRegExp('a.b').test('axb')).toBe(false);
  });
});
