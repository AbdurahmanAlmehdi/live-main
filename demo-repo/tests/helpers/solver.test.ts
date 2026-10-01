import { describe, expect, it } from 'vitest';
import { solveNewton } from '../../src/helpers/solver';

describe('solveNewton', () => {
  it('finds roots near the guess', () => {
    expect(solveNewton((x) => x * x - 2, 1)).toBeCloseTo(Math.SQRT2, 9);
    expect(solveNewton((x) => x * x - 2, -1)).toBeCloseTo(-Math.SQRT2, 9);
    expect(solveNewton((x) => Math.cos(x) - x, 0.5)).toBeCloseTo(0.739085133215161, 9);
  });

  it('gives #NUM! when there is no root', () => {
    expect(solveNewton((x) => x * x + 1, 0.5)).toMatchObject({ code: '#NUM!' });
  });

  it('respects the iteration limit', () => {
    expect(solveNewton((x) => x * x - 2, 1000, { maxIterations: 2 })).toMatchObject({ code: '#NUM!' });
  });
});
