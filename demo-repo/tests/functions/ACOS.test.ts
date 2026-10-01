// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ACOS', () => {
  it('=ACOS(-0.5)', async () => {
    expect(await evaluate('=ACOS(-0.5)')).toBeCloseTo(2.0943951023931957, 8);
  });
  it('=ACOS(1)', async () => {
    expect(await evaluate('=ACOS(1)')).toBeCloseTo(0, 9);
  });
  it('=ACOS(0)', async () => {
    expect(await evaluate('=ACOS(0)')).toBeCloseTo(1.5707963267948966, 8);
  });
  it('=ACOS(0.25)', async () => {
    expect(await evaluate('=ACOS(0.25)')).toBeCloseTo(1.318116071652818, 8);
  });
  it('=ACOS(2)', async () => {
    expect(await evaluate('=ACOS(2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=ACOS("x")', async () => {
    expect(await evaluate('=ACOS("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
