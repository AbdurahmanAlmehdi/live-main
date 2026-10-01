import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('MAX', () => {
  it('finds the largest number', async () => {
    expect(await evaluate('=MAX(1,7,3)')).toBeCloseTo(7, 9);
  });
  it('is zero for no args', async () => {
    expect(await evaluate('=MAX()')).toBeCloseTo(0, 9);
  });
});
