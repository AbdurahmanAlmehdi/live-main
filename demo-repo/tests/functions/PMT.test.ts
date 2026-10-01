// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('PMT', () => {
  it('=PMT(0.08/12, 10, 10000)', async () => {
    expect(await evaluate('=PMT(0.08/12, 10, 10000)')).toBeCloseTo(-1037.0320893591643, 5);
  });
  it('=PMT(0.08/12, 10, 10000, 0, 1)', async () => {
    expect(await evaluate('=PMT(0.08/12, 10, 10000, 0, 1)')).toBeCloseTo(-1030.1643271779778, 5);
  });
  it('=PMT(0.06/12, 18*12, 0, 50000)', async () => {
    expect(await evaluate('=PMT(0.06/12, 18*12, 0, 50000)')).toBeCloseTo(-129.0811608679954, 6);
  });
  it('=PMT(0, 12, 1200)', async () => {
    expect(await evaluate('=PMT(0, 12, 1200)')).toBeCloseTo(-100, 7);
  });
  it('=PMT(0.05, 10, -1000, 500, 1)', async () => {
    expect(await evaluate('=PMT(0.05, 10, -1000, 500, 1)')).toBeCloseTo(85.47836903116982, 7);
  });
  it('=PMT(0.1, 0, 1000)', async () => {
    expect(await evaluate('=PMT(0.1, 0, 1000)')).toMatchObject({ code: '#NUM!' });
  });
  it('=PMT("x", 10, 1000)', async () => {
    expect(await evaluate('=PMT("x", 10, 1000)')).toMatchObject({ code: '#VALUE!' });
  });
});
