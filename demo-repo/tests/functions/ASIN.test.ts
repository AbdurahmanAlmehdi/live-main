// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ASIN', () => {
  it('=ASIN(-0.5)', async () => {
    expect(await evaluate('=ASIN(-0.5)')).toBeCloseTo(-0.5235987755982989, 9);
  });
  it('=ASIN(1)', async () => {
    expect(await evaluate('=ASIN(1)')).toBeCloseTo(1.5707963267948966, 8);
  });
  it('=ASIN(0)', async () => {
    expect(await evaluate('=ASIN(0)')).toBeCloseTo(0, 9);
  });
  it('=ASIN(0.3)', async () => {
    expect(await evaluate('=ASIN(0.3)')).toBeCloseTo(0.3046926540153975, 9);
  });
  it('=ASIN(-1.5)', async () => {
    expect(await evaluate('=ASIN(-1.5)')).toMatchObject({ code: '#NUM!' });
  });
  it('=ASIN("x")', async () => {
    expect(await evaluate('=ASIN("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
