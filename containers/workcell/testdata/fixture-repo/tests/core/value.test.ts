import { describe, expect, it } from 'vitest';
import { toNumber, toText } from '../../src/core/value';

describe('value', () => {
  it('coerces to number', () => {
    expect(toNumber('4')).toBe(4);
    expect(toNumber(null)).toBe(0);
  });
  it('coerces to text', () => {
    expect(toText(true)).toBe('TRUE');
  });
});
