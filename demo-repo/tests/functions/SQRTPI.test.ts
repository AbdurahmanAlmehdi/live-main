// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SQRTPI', () => {
  it('=SQRTPI(1)', async () => {
    expect(await evaluate('=SQRTPI(1)')).toBeCloseTo(1.7724538509055159, 8);
  });
  it('=SQRTPI(2)', async () => {
    expect(await evaluate('=SQRTPI(2)')).toBeCloseTo(2.5066282746310002, 8);
  });
  it('=SQRTPI(0)', async () => {
    expect(await evaluate('=SQRTPI(0)')).toBeCloseTo(0, 9);
  });
  it('=SQRTPI(-1)', async () => {
    expect(await evaluate('=SQRTPI(-1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=SQRTPI("x")', async () => {
    expect(await evaluate('=SQRTPI("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
