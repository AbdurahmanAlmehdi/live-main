// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('CEILING.MATH', () => {
  it('=CEILING.MATH(24.3, 5)', async () => {
    expect(await evaluate('=CEILING.MATH(24.3, 5)')).toBeCloseTo(25, 7);
  });
  it('=CEILING.MATH(6.7)', async () => {
    expect(await evaluate('=CEILING.MATH(6.7)')).toBeCloseTo(7, 8);
  });
  it('=CEILING.MATH(-8.1, 2)', async () => {
    expect(await evaluate('=CEILING.MATH(-8.1, 2)')).toBeCloseTo(-8, 8);
  });
  it('=CEILING.MATH(-5.5, 2, -1)', async () => {
    expect(await evaluate('=CEILING.MATH(-5.5, 2, -1)')).toBeCloseTo(-6, 8);
  });
  it('=CEILING.MATH(-5.5, 2, 0)', async () => {
    expect(await evaluate('=CEILING.MATH(-5.5, 2, 0)')).toBeCloseTo(-4, 8);
  });
  it('=CEILING.MATH(5.5, -2)', async () => {
    expect(await evaluate('=CEILING.MATH(5.5, -2)')).toBeCloseTo(6, 8);
  });
  it('=CEILING.MATH(0, 4)', async () => {
    expect(await evaluate('=CEILING.MATH(0, 4)')).toBeCloseTo(0, 9);
  });
  it('=CEILING.MATH("x")', async () => {
    expect(await evaluate('=CEILING.MATH("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
