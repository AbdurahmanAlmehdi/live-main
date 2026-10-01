// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('MINUTE', () => {
  it('=MINUTE(0.75)', async () => {
    expect(await evaluate('=MINUTE(0.75)')).toBeCloseTo(0, 9);
  });
  it('=MINUTE(TIME(10, 25, 59))', async () => {
    expect(await evaluate('=MINUTE(TIME(10, 25, 59))')).toBeCloseTo(25, 7);
  });
  it('=MINUTE(0.0104166666666667)', async () => {
    expect(await evaluate('=MINUTE(0.0104166666666667)')).toBeCloseTo(15, 7);
  });
  it('=MINUTE(43845.51)', async () => {
    expect(await evaluate('=MINUTE(43845.51)')).toBeCloseTo(14, 7);
  });
  it('=MINUTE(-1)', async () => {
    expect(await evaluate('=MINUTE(-1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=MINUTE("x")', async () => {
    expect(await evaluate('=MINUTE("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
