// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ROUND', () => {
  it('=ROUND(2.15, 1)', async () => {
    expect(await evaluate('=ROUND(2.15, 1)')).toBeCloseTo(2.2, 8);
  });
  it('=ROUND(2.149, 1)', async () => {
    expect(await evaluate('=ROUND(2.149, 1)')).toBeCloseTo(2.1, 8);
  });
  it('=ROUND(-1.475, 2)', async () => {
    expect(await evaluate('=ROUND(-1.475, 2)')).toBeCloseTo(-1.48, 8);
  });
  it('=ROUND(21.5, -1)', async () => {
    expect(await evaluate('=ROUND(21.5, -1)')).toBeCloseTo(20, 7);
  });
  it('=ROUND(626.3, -3)', async () => {
    expect(await evaluate('=ROUND(626.3, -3)')).toBeCloseTo(1000, 6);
  });
  it('=ROUND(2.5, 0)', async () => {
    expect(await evaluate('=ROUND(2.5, 0)')).toBeCloseTo(3, 8);
  });
  it('=ROUND(-2.5, 0)', async () => {
    expect(await evaluate('=ROUND(-2.5, 0)')).toBeCloseTo(-3, 8);
  });
  it('=ROUND(1.005, 2)', async () => {
    expect(await evaluate('=ROUND(1.005, 2)')).toBeCloseTo(1.01, 8);
  });
  it('=ROUND(1234.5678, -1.5)', async () => {
    expect(await evaluate('=ROUND(1234.5678, -1.5)')).toBeCloseTo(1230, 5);
  });
  it('=ROUND(1234.5678, 2.9)', async () => {
    expect(await evaluate('=ROUND(1234.5678, 2.9)')).toBeCloseTo(1234.57, 5);
  });
  it('=ROUND("x", 1)', async () => {
    expect(await evaluate('=ROUND("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
