import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SUM', () => {
  it('adds numbers', async () => {
    expect(await evaluate('=SUM(1,2,3)')).toBeCloseTo(6, 9);
  });
  it('coerces booleans', async () => {
    expect(await evaluate('=SUM(TRUE,2)')).toBeCloseTo(3, 9);
  });
  it('is zero for no args', async () => {
    expect(await evaluate('=SUM()')).toBeCloseTo(0, 9);
  });
});
