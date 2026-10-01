// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('NORM.INV', () => {
  it('=NORM.INV(0.908789, 40, 1.5)', async () => {
    expect(await evaluate('=NORM.INV(0.908789, 40, 1.5)')).toBeCloseTo(42.00000200956616, 7);
  });
  it('=NORM.INV(0.5, 10, 2)', async () => {
    expect(await evaluate('=NORM.INV(0.5, 10, 2)')).toBeCloseTo(10, 8);
  });
  it('=NORM.INV(0.01, 0, 1)', async () => {
    expect(await evaluate('=NORM.INV(0.01, 0, 1)')).toBeCloseTo(-2.3263478740408403, 8);
  });
  it('=NORM.INV(0.999, 5, 3)', async () => {
    expect(await evaluate('=NORM.INV(0.999, 5, 3)')).toBeCloseTo(14.270696918503461, 7);
  });
  it('=NORM.INV(0, 0, 1)', async () => {
    expect(await evaluate('=NORM.INV(0, 0, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=NORM.INV(1, 0, 1)', async () => {
    expect(await evaluate('=NORM.INV(1, 0, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=NORM.INV(0.5, 0, 0)', async () => {
    expect(await evaluate('=NORM.INV(0.5, 0, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=NORM.INV("x", 0, 1)', async () => {
    expect(await evaluate('=NORM.INV("x", 0, 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
