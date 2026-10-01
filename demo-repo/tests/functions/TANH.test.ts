// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('TANH', () => {
  it('=TANH(-2)', async () => {
    expect(await evaluate('=TANH(-2)')).toBeCloseTo(-0.9640275800758168, 9);
  });
  it('=TANH(0)', async () => {
    expect(await evaluate('=TANH(0)')).toBeCloseTo(0, 9);
  });
  it('=TANH(0.5)', async () => {
    expect(await evaluate('=TANH(0.5)')).toBeCloseTo(0.46211715726000974, 9);
  });
  it('=TANH(100)', async () => {
    expect(await evaluate('=TANH(100)')).toBeCloseTo(1, 9);
  });
  it('=TANH("x")', async () => {
    expect(await evaluate('=TANH("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
