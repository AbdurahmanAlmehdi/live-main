// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('RATE', () => {
  it('=RATE(4*12, -200, 8000)', async () => {
    expect(await evaluate('=RATE(4*12, -200, 8000)')).toBeCloseTo(0.007701472488202071, 9);
  });
  it('=RATE(4*12, -200, 8000)*12', async () => {
    expect(await evaluate('=RATE(4*12, -200, 8000)*12')).toBeCloseTo(0.09241766985842485, 9);
  });
  it('=RATE(10, -100, 700, 0, 1)', async () => {
    expect(await evaluate('=RATE(10, -100, 700, 0, 1)')).toBeCloseTo(0.0898051031100071, 9);
  });
  it('=RATE(5, 0, -1000, 1500)', async () => {
    expect(await evaluate('=RATE(5, 0, -1000, 1500)')).toBeCloseTo(0.08447177119769864, 9);
  });
  it('=RATE(36, -300, 9000, 0, 0, 0.01)', async () => {
    expect(await evaluate('=RATE(36, -300, 9000, 0, 0, 0.01)')).toBeCloseTo(0.010207449002719577, 9);
  });
  it('=RATE(12, -100, 1200)', async () => {
    expect(await evaluate('=RATE(12, -100, 1200)')).toBeCloseTo(-2.905989341839753e-18, 9);
  });
  it('=RATE(0, -100, 1000)', async () => {
    expect(await evaluate('=RATE(0, -100, 1000)')).toMatchObject({ code: '#NUM!' });
  });
  it('=RATE(10, 100, 1000)', async () => {
    expect(await evaluate('=RATE(10, 100, 1000)')).toMatchObject({ code: '#NUM!' });
  });
  it('=RATE("x", -100, 1000)', async () => {
    expect(await evaluate('=RATE("x", -100, 1000)')).toMatchObject({ code: '#VALUE!' });
  });
});
