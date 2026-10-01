// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('PERCENTILE.EXC', () => {
  it('=PERCENTILE.EXC({1, 2, 3, 6, 6, 6, 7, 8, 9}, 0.25)', async () => {
    expect(await evaluate('=PERCENTILE.EXC({1, 2, 3, 6, 6, 6, 7, 8, 9}, 0.25)')).toBeCloseTo(2.5, 8);
  });
  it('=PERCENTILE.EXC({3, 4, 5, 2, 3, 4, 5, 6, 4, 7}, 0.5)', async () => {
    expect(await evaluate('=PERCENTILE.EXC({3, 4, 5, 2, 3, 4, 5, 6, 4, 7}, 0.5)')).toBeCloseTo(4, 8);
  });
  it('=PERCENTILE.EXC({1, 2, 3, 4}, 0.4)', async () => {
    expect(await evaluate('=PERCENTILE.EXC({1, 2, 3, 4}, 0.4)')).toBeCloseTo(2, 8);
  });
  it('=PERCENTILE.EXC({1, "a", 3, 5}, 0.5)', async () => {
    expect(await evaluate('=PERCENTILE.EXC({1, "a", 3, 5}, 0.5)')).toBeCloseTo(3, 8);
  });
  it('=PERCENTILE.EXC({1, 2, 3}, 0.1)', async () => {
    expect(await evaluate('=PERCENTILE.EXC({1, 2, 3}, 0.1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=PERCENTILE.EXC({1, 2, 3}, 0)', async () => {
    expect(await evaluate('=PERCENTILE.EXC({1, 2, 3}, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=PERCENTILE.EXC({1, 2, 3}, 1)', async () => {
    expect(await evaluate('=PERCENTILE.EXC({1, 2, 3}, 1)')).toMatchObject({ code: '#NUM!' });
  });
});
