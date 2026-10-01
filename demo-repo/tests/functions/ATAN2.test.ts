// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ATAN2', () => {
  it('=ATAN2(1, 1)', async () => {
    expect(await evaluate('=ATAN2(1, 1)')).toBeCloseTo(0.7853981633974483, 9);
  });
  it('=ATAN2(-1, -1)', async () => {
    expect(await evaluate('=ATAN2(-1, -1)')).toBeCloseTo(-2.356194490192345, 8);
  });
  it('=ATAN2(-1, 0)', async () => {
    expect(await evaluate('=ATAN2(-1, 0)')).toBeCloseTo(3.141592653589793, 8);
  });
  it('=ATAN2(0, 2)', async () => {
    expect(await evaluate('=ATAN2(0, 2)')).toBeCloseTo(1.5707963267948966, 8);
  });
  it('=ATAN2(0, 0)', async () => {
    expect(await evaluate('=ATAN2(0, 0)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=ATAN2("x", 1)', async () => {
    expect(await evaluate('=ATAN2("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
