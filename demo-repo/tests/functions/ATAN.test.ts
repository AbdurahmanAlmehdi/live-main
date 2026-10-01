// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ATAN', () => {
  it('=ATAN(1)', async () => {
    expect(await evaluate('=ATAN(1)')).toBeCloseTo(0.7853981633974483, 9);
  });
  it('=ATAN(-2)', async () => {
    expect(await evaluate('=ATAN(-2)')).toBeCloseTo(-1.1071487177940904, 8);
  });
  it('=ATAN(0)', async () => {
    expect(await evaluate('=ATAN(0)')).toBeCloseTo(0, 9);
  });
  it('=ATAN(1000)', async () => {
    expect(await evaluate('=ATAN(1000)')).toBeCloseTo(1.5697963271282298, 8);
  });
  it('=ATAN("x")', async () => {
    expect(await evaluate('=ATAN("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
