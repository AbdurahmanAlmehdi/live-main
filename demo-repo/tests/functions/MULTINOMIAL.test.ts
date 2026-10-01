// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('MULTINOMIAL', () => {
  it('=MULTINOMIAL(2, 3, 4)', async () => {
    expect(await evaluate('=MULTINOMIAL(2, 3, 4)')).toBeCloseTo(1260, 5);
  });
  it('=MULTINOMIAL(1, 1)', async () => {
    expect(await evaluate('=MULTINOMIAL(1, 1)')).toBeCloseTo(2, 8);
  });
  it('=MULTINOMIAL(5)', async () => {
    expect(await evaluate('=MULTINOMIAL(5)')).toBeCloseTo(1, 9);
  });
  it('=MULTINOMIAL({1, 2}, 3)', async () => {
    expect(await evaluate('=MULTINOMIAL({1, 2}, 3)')).toBeCloseTo(60, 7);
  });
  it('=MULTINOMIAL(0, 0)', async () => {
    expect(await evaluate('=MULTINOMIAL(0, 0)')).toBeCloseTo(1, 9);
  });
  it('=MULTINOMIAL(-1, 2)', async () => {
    expect(await evaluate('=MULTINOMIAL(-1, 2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=MULTINOMIAL("x")', async () => {
    expect(await evaluate('=MULTINOMIAL("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
