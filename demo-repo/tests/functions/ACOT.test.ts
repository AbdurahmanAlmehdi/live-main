// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ACOT', () => {
  it('=ACOT(2)', async () => {
    expect(await evaluate('=ACOT(2)')).toBeCloseTo(0.4636476090008061, 9);
  });
  it('=ACOT(1)', async () => {
    expect(await evaluate('=ACOT(1)')).toBeCloseTo(0.7853981633974483, 9);
  });
  it('=ACOT(0)', async () => {
    expect(await evaluate('=ACOT(0)')).toBeCloseTo(1.5707963267948966, 8);
  });
  it('=ACOT(-1)', async () => {
    expect(await evaluate('=ACOT(-1)')).toBeCloseTo(2.356194490192345, 8);
  });
  it('=ACOT("x")', async () => {
    expect(await evaluate('=ACOT("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
