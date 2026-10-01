// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DOLLARFR', () => {
  it('=DOLLARFR(1.125, 16)', async () => {
    expect(await evaluate('=DOLLARFR(1.125, 16)')).toBeCloseTo(1.02, 8);
  });
  it('=DOLLARFR(1.125, 32)', async () => {
    expect(await evaluate('=DOLLARFR(1.125, 32)')).toBeCloseTo(1.04, 8);
  });
  it('=DOLLARFR(-1.125, 16)', async () => {
    expect(await evaluate('=DOLLARFR(-1.125, 16)')).toBeCloseTo(-1.02, 8);
  });
  it('=DOLLARFR(2.5, 4)', async () => {
    expect(await evaluate('=DOLLARFR(2.5, 4)')).toBeCloseTo(2.2, 8);
  });
  it('=DOLLARFR(1.125, 16.9)', async () => {
    expect(await evaluate('=DOLLARFR(1.125, 16.9)')).toBeCloseTo(1.02, 8);
  });
  it('=DOLLARFR(1.125, 0)', async () => {
    expect(await evaluate('=DOLLARFR(1.125, 0)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=DOLLARFR(1.125, -1)', async () => {
    expect(await evaluate('=DOLLARFR(1.125, -1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DOLLARFR("x", 16)', async () => {
    expect(await evaluate('=DOLLARFR("x", 16)')).toMatchObject({ code: '#VALUE!' });
  });
});
