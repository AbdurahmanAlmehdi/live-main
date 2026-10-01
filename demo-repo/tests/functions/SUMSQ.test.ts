// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SUMSQ', () => {
  it('=SUMSQ(3, 4)', async () => {
    expect(await evaluate('=SUMSQ(3, 4)')).toBeCloseTo(25, 7);
  });
  it('=SUMSQ({1, 2, 3})', async () => {
    expect(await evaluate('=SUMSQ({1, 2, 3})')).toBeCloseTo(14, 7);
  });
  it('=SUMSQ({1, "a", TRUE}, 2)', async () => {
    expect(await evaluate('=SUMSQ({1, "a", TRUE}, 2)')).toBeCloseTo(5, 8);
  });
  it('=SUMSQ(-2.5)', async () => {
    expect(await evaluate('=SUMSQ(-2.5)')).toBeCloseTo(6.25, 8);
  });
  it('=SUMSQ("3")', async () => {
    expect(await evaluate('=SUMSQ("3")')).toBeCloseTo(9, 8);
  });
  it('=SUMSQ(1, "x")', async () => {
    expect(await evaluate('=SUMSQ(1, "x")')).toMatchObject({ code: '#VALUE!' });
  });
});
