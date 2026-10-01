import { describe, expect, it } from 'vitest';
import { combinations, doubleFactorial, factorial, permutations } from '../../src/helpers/combinatorics';

describe('combinatorics', () => {
  it('factorial', () => {
    expect(factorial(0)).toBe(1);
    expect(factorial(5)).toBe(120);
    expect(factorial(20)).toBe(2432902008176640000);
    expect(factorial(171)).toBe(Infinity);
  });

  it('doubleFactorial', () => {
    expect(doubleFactorial(0)).toBe(1);
    expect(doubleFactorial(7)).toBe(105);
    expect(doubleFactorial(8)).toBe(384);
  });

  it('combinations', () => {
    expect(combinations(5, 2)).toBe(10);
    expect(combinations(10, 0)).toBe(1);
    expect(combinations(52, 5)).toBe(2598960);
  });

  it('permutations', () => {
    expect(permutations(5, 2)).toBe(20);
    expect(permutations(4, 0)).toBe(1);
    expect(permutations(10, 3)).toBe(720);
  });
});
