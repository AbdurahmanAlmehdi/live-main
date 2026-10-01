// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ERF', () => {
  it('=ERF(0.745)', async () => {
    expect(await evaluate('=ERF(0.745)')).toBeCloseTo(0.7079289200957377, 9);
  });
  it('=ERF(1)', async () => {
    expect(await evaluate('=ERF(1)')).toBeCloseTo(0.8427007929497149, 9);
  });
  it('=ERF(0)', async () => {
    expect(await evaluate('=ERF(0)')).toBeCloseTo(0, 9);
  });
  it('=ERF(-1)', async () => {
    expect(await evaluate('=ERF(-1)')).toBeCloseTo(-0.8427007929497149, 9);
  });
  it('=ERF(3)', async () => {
    expect(await evaluate('=ERF(3)')).toBeCloseTo(0.9999779095030014, 9);
  });
  it('=ERF(1, 2)', async () => {
    expect(await evaluate('=ERF(1, 2)')).toBeCloseTo(0.15262147206923787, 9);
  });
  it('=ERF(2, 1)', async () => {
    expect(await evaluate('=ERF(2, 1)')).toBeCloseTo(-0.15262147206923787, 9);
  });
  it('=ERF(0.1)', async () => {
    expect(await evaluate('=ERF(0.1)')).toBeCloseTo(0.11246291601828495, 9);
  });
  it('=ERF("x")', async () => {
    expect(await evaluate('=ERF("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
