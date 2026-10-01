// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('STANDARDIZE', () => {
  it('=STANDARDIZE(42, 40, 1.5)', async () => {
    expect(await evaluate('=STANDARDIZE(42, 40, 1.5)')).toBeCloseTo(1.3333333333333333, 8);
  });
  it('=STANDARDIZE(10, 10, 2)', async () => {
    expect(await evaluate('=STANDARDIZE(10, 10, 2)')).toBeCloseTo(0, 9);
  });
  it('=STANDARDIZE(-1, 2, 0.5)', async () => {
    expect(await evaluate('=STANDARDIZE(-1, 2, 0.5)')).toBeCloseTo(-6, 8);
  });
  it('=STANDARDIZE(1, 2, 0)', async () => {
    expect(await evaluate('=STANDARDIZE(1, 2, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=STANDARDIZE("x", 1, 1)', async () => {
    expect(await evaluate('=STANDARDIZE("x", 1, 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
