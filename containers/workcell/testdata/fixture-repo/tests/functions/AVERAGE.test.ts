import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('AVERAGE', () => {
  it('averages numbers', async () => {
    expect(await evaluate('=AVERAGE(1,2,3,4)')).toBeCloseTo(2.5, 9);
  });
  it('errors on no args', async () => {
    expect(await evaluate('=AVERAGE()')).toBe('#DIV/0!');
  });
});
