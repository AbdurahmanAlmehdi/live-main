// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('IPMT', () => {
  it('=IPMT(0.1/12, 1, 3*12, 8000)', async () => {
    expect(await evaluate('=IPMT(0.1/12, 1, 3*12, 8000)')).toBeCloseTo(-66.66666666666667, 7);
  });
  it('=IPMT(0.1, 3, 3, 8000)', async () => {
    expect(await evaluate('=IPMT(0.1, 3, 3, 8000)')).toBeCloseTo(-292.4471299093658, 6);
  });
  it('=IPMT(0.1, 1, 3, 8000, 0, 1)', async () => {
    expect(await evaluate('=IPMT(0.1, 1, 3, 8000, 0, 1)')).toBeCloseTo(0, 9);
  });
  it('=IPMT(0.1, 2, 3, 8000, 0, 1)', async () => {
    expect(await evaluate('=IPMT(0.1, 2, 3, 8000, 0, 1)')).toBeCloseTo(-507.5528700906347, 6);
  });
  it('=IPMT(0.05, 4, 10, -5000, 1000)', async () => {
    expect(await evaluate('=IPMT(0.05, 4, 10, -5000, 1000)')).toBeCloseTo(199.8723654842796, 6);
  });
  it('=IPMT(0, 2, 5, 1000)', async () => {
    expect(await evaluate('=IPMT(0, 2, 5, 1000)')).toBeCloseTo(0, 9);
  });
  it('=IPMT(0.1, 0, 3, 8000)', async () => {
    expect(await evaluate('=IPMT(0.1, 0, 3, 8000)')).toMatchObject({ code: '#NUM!' });
  });
  it('=IPMT(0.1, 4, 3, 8000)', async () => {
    expect(await evaluate('=IPMT(0.1, 4, 3, 8000)')).toMatchObject({ code: '#NUM!' });
  });
  it('=IPMT("x", 1, 3, 8000)', async () => {
    expect(await evaluate('=IPMT("x", 1, 3, 8000)')).toMatchObject({ code: '#VALUE!' });
  });
});
