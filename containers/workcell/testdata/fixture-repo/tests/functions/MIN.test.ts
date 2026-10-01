import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('MIN', () => {
  it('finds the smallest number', async () => {
    expect(await evaluate('=MIN(4,2,9)')).toBeCloseTo(2, 9);
  });
  it('is zero for no args', async () => {
    expect(await evaluate('=MIN()')).toBeCloseTo(0, 9);
  });
});
