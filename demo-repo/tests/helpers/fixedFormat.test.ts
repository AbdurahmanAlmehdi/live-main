import { describe, expect, it } from 'vitest';
import { formatFixed } from '../../src/helpers/fixedFormat';

describe('formatFixed', () => {
  it('rounds and groups', () => {
    expect(formatFixed(1234.567, 2, true)).toBe('1,234.57');
    expect(formatFixed(1234.567, 1, false)).toBe('1234.6');
    expect(formatFixed(-1234.567, 0, true)).toBe('-1,235');
  });

  it('pads decimals', () => {
    expect(formatFixed(5, 3, true)).toBe('5.000');
  });

  it('supports negative decimals', () => {
    expect(formatFixed(1234.567, -2, true)).toBe('1,200');
  });

  it('rounds halves away from zero', () => {
    expect(formatFixed(2.675, 2, true)).toBe('2.68');
    expect(formatFixed(-0.5, 0, true)).toBe('-1');
  });
});
