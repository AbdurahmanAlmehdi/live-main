// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('TRIMMEAN', () => {
  it('=TRIMMEAN({4, 5, 6, 7, 2, 3, 4, 5, 1, 2, 3}, 0.2)', async () => {
    expect(await evaluate('=TRIMMEAN({4, 5, 6, 7, 2, 3, 4, 5, 1, 2, 3}, 0.2)')).toBeCloseTo(3.7777777777777777, 8);
  });
  it('=TRIMMEAN({3, 4, 5, 2, 3, 4, 5, 6, 4, 7}, 0.4)', async () => {
    expect(await evaluate('=TRIMMEAN({3, 4, 5, 2, 3, 4, 5, 6, 4, 7}, 0.4)')).toBeCloseTo(4.166666666666667, 8);
  });
  it('=TRIMMEAN({1, 2, 3}, 0)', async () => {
    expect(await evaluate('=TRIMMEAN({1, 2, 3}, 0)')).toBeCloseTo(2, 8);
  });
  it('=TRIMMEAN({1, 2, 3, 100}, 0.5)', async () => {
    expect(await evaluate('=TRIMMEAN({1, 2, 3, 100}, 0.5)')).toBeCloseTo(2.5, 8);
  });
  it('=TRIMMEAN({1, 2}, 1)', async () => {
    expect(await evaluate('=TRIMMEAN({1, 2}, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=TRIMMEAN({1, 2}, -0.1)', async () => {
    expect(await evaluate('=TRIMMEAN({1, 2}, -0.1)')).toMatchObject({ code: '#NUM!' });
  });
});
