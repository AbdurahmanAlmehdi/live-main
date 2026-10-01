import { describe, expect, it } from 'vitest';
import { parseCriterion } from '../../src/helpers/criteria';

describe('parseCriterion', () => {
  it('matches numbers and booleans by value and type', () => {
    expect(parseCriterion(5)(5)).toBe(true);
    expect(parseCriterion(5)('5')).toBe(false);
    expect(parseCriterion(true)(true)).toBe(true);
    expect(parseCriterion(true)(1)).toBe(false);
  });

  it('supports comparison operators on numbers', () => {
    expect(parseCriterion('>3')(4)).toBe(true);
    expect(parseCriterion('>3')(3)).toBe(false);
    expect(parseCriterion('<=3')(3)).toBe(true);
    expect(parseCriterion('<>3')(4)).toBe(true);
    expect(parseCriterion('<>3')('x')).toBe(true);
    expect(parseCriterion('>3')('x')).toBe(false);
  });

  it('matches text case-insensitively with wildcards', () => {
    expect(parseCriterion('apple')('APPLE')).toBe(true);
    expect(parseCriterion('a*')('avocado')).toBe(true);
    expect(parseCriterion('<>a*')('banana')).toBe(true);
    expect(parseCriterion('=b?')('bx')).toBe(true);
    expect(parseCriterion('>m')('pear')).toBe(true);
  });

  it('handles empty criteria', () => {
    expect(parseCriterion('')(null)).toBe(true);
    expect(parseCriterion('')('')).toBe(true);
    expect(parseCriterion('=')(null)).toBe(true);
    expect(parseCriterion('<>')('x')).toBe(true);
    expect(parseCriterion('<>')(null)).toBe(false);
  });
});
