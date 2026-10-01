// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('FISHERINV', () => {
  it('=FISHERINV(0.972955)', async () => {
    expect(await evaluate('=FISHERINV(0.972955)')).toBeCloseTo(0.7499999673941484, 9);
  });
  it('=FISHERINV(0)', async () => {
    expect(await evaluate('=FISHERINV(0)')).toBeCloseTo(0, 9);
  });
  it('=FISHERINV(-2)', async () => {
    expect(await evaluate('=FISHERINV(-2)')).toBeCloseTo(-0.9640275800758168, 9);
  });
  it('=FISHERINV(10)', async () => {
    expect(await evaluate('=FISHERINV(10)')).toBeCloseTo(0.9999999958776927, 9);
  });
  it('=FISHERINV("x")', async () => {
    expect(await evaluate('=FISHERINV("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
