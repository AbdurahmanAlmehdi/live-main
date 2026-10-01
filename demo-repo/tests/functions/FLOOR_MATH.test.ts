// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('FLOOR.MATH', () => {
  it('=FLOOR.MATH(24.3, 5)', async () => {
    expect(await evaluate('=FLOOR.MATH(24.3, 5)')).toBeCloseTo(20, 7);
  });
  it('=FLOOR.MATH(6.7)', async () => {
    expect(await evaluate('=FLOOR.MATH(6.7)')).toBeCloseTo(6, 8);
  });
  it('=FLOOR.MATH(-8.1, 2)', async () => {
    expect(await evaluate('=FLOOR.MATH(-8.1, 2)')).toBeCloseTo(-10, 8);
  });
  it('=FLOOR.MATH(-5.5, 2, -1)', async () => {
    expect(await evaluate('=FLOOR.MATH(-5.5, 2, -1)')).toBeCloseTo(-4, 8);
  });
  it('=FLOOR.MATH(-5.5, 2)', async () => {
    expect(await evaluate('=FLOOR.MATH(-5.5, 2)')).toBeCloseTo(-6, 8);
  });
  it('=FLOOR.MATH(5.5, -2)', async () => {
    expect(await evaluate('=FLOOR.MATH(5.5, -2)')).toBeCloseTo(4, 8);
  });
  it('=FLOOR.MATH(0, 3)', async () => {
    expect(await evaluate('=FLOOR.MATH(0, 3)')).toBeCloseTo(0, 9);
  });
  it('=FLOOR.MATH("x")', async () => {
    expect(await evaluate('=FLOOR.MATH("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
