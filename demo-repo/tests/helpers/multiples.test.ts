import { describe, expect, it } from 'vitest';
import { ceilToMultiple, floorToMultiple, roundToMultiple } from '../../src/helpers/multiples';

describe('multiples', () => {
  it('floors toward -infinity', () => {
    expect(floorToMultiple(7, 2)).toBe(6);
    expect(floorToMultiple(-7, 2)).toBe(-8);
    expect(floorToMultiple(2.5, 0.1)).toBe(2.5);
  });

  it('ceils toward +infinity', () => {
    expect(ceilToMultiple(7, 2)).toBe(8);
    expect(ceilToMultiple(-7, 2)).toBe(-6);
    expect(ceilToMultiple(0.3, 0.1)).toBe(0.3);
  });

  it('is robust to binary noise', () => {
    expect(floorToMultiple(0.3, 0.1)).toBe(0.3);
    expect(ceilToMultiple(4.42, 0.05)).toBe(4.45);
  });

  it('rounds to the nearest multiple, halves away from zero', () => {
    expect(roundToMultiple(10, 3)).toBe(9);
    expect(roundToMultiple(7.5, 5)).toBe(10);
    expect(roundToMultiple(-7.5, 5)).toBe(-10);
    expect(roundToMultiple(1.3, 0.2)).toBe(1.4);
  });
});
