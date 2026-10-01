// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('PERCENTILE.INC', () => {
  it('=PERCENTILE.INC({1, 3, 2, 4}, 0.3)', async () => {
    expect(await evaluate('=PERCENTILE.INC({1, 3, 2, 4}, 0.3)')).toBeCloseTo(1.9, 8);
  });
  it('=PERCENTILE.INC({3, 4, 5, 2, 3, 4, 5, 6, 4, 7}, 0.9)', async () => {
    expect(await evaluate('=PERCENTILE.INC({3, 4, 5, 2, 3, 4, 5, 6, 4, 7}, 0.9)')).toBeCloseTo(6.1, 8);
  });
  it('=PERCENTILE.INC({10, 20}, 0)', async () => {
    expect(await evaluate('=PERCENTILE.INC({10, 20}, 0)')).toBeCloseTo(10, 8);
  });
  it('=PERCENTILE.INC({10, 20}, 1)', async () => {
    expect(await evaluate('=PERCENTILE.INC({10, 20}, 1)')).toBeCloseTo(20, 7);
  });
  it('=PERCENTILE.INC({1, "a", 3}, 0.5)', async () => {
    expect(await evaluate('=PERCENTILE.INC({1, "a", 3}, 0.5)')).toBeCloseTo(2, 8);
  });
  it('=PERCENTILE.INC({1, 2}, 1.5)', async () => {
    expect(await evaluate('=PERCENTILE.INC({1, 2}, 1.5)')).toMatchObject({ code: '#NUM!' });
  });
  it('=PERCENTILE.INC({1, 2}, -0.1)', async () => {
    expect(await evaluate('=PERCENTILE.INC({1, 2}, -0.1)')).toMatchObject({ code: '#NUM!' });
  });
});
