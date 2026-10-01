import { describe, expect, it } from 'vitest';
import { toBitOperand } from '../../src/helpers/bits';

describe('toBitOperand', () => {
  it('accepts whole numbers in [0, 2^48)', () => {
    expect(toBitOperand(0)).toBe(0);
    expect(toBitOperand(13)).toBe(13);
    expect(toBitOperand('5')).toBe(5);
    expect(toBitOperand(2 ** 48 - 1)).toBe(2 ** 48 - 1);
  });

  it('rejects fractions, negatives and large numbers', () => {
    expect(toBitOperand(1.5)).toMatchObject({ code: '#NUM!' });
    expect(toBitOperand(-1)).toMatchObject({ code: '#NUM!' });
    expect(toBitOperand(2 ** 48)).toMatchObject({ code: '#NUM!' });
  });

  it('passes coercion errors through', () => {
    expect(toBitOperand('abc')).toMatchObject({ code: '#VALUE!' });
  });
});
