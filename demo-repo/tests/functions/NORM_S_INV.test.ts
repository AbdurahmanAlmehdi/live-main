// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('NORM.S.INV', () => {
  it('=NORM.S.INV(0.908789)', async () => {
    expect(await evaluate('=NORM.S.INV(0.908789)')).toBeCloseTo(1.3333346730441074, 8);
  });
  it('=NORM.S.INV(0.5)', async () => {
    expect(await evaluate('=NORM.S.INV(0.5)')).toBeCloseTo(0, 9);
  });
  it('=NORM.S.INV(0.025)', async () => {
    expect(await evaluate('=NORM.S.INV(0.025)')).toBeCloseTo(-1.9599639845400547, 8);
  });
  it('=NORM.S.INV(0.975)', async () => {
    expect(await evaluate('=NORM.S.INV(0.975)')).toBeCloseTo(1.9599639845400545, 8);
  });
  it('=NORM.S.INV(1E-10)', async () => {
    expect(await evaluate('=NORM.S.INV(1E-10)')).toBeCloseTo(-6.361340902404057, 8);
  });
  it('=NORM.S.INV(0)', async () => {
    expect(await evaluate('=NORM.S.INV(0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=NORM.S.INV(1.5)', async () => {
    expect(await evaluate('=NORM.S.INV(1.5)')).toMatchObject({ code: '#NUM!' });
  });
  it('=NORM.S.INV("x")', async () => {
    expect(await evaluate('=NORM.S.INV("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
