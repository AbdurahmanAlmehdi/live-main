// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DATE', () => {
  it('=DATE(2020, 1, 15)', async () => {
    expect(await evaluate('=DATE(2020, 1, 15)')).toBeCloseTo(43845, 4);
  });
  it('=DATE(2008, 14, 2)', async () => {
    expect(await evaluate('=DATE(2008, 14, 2)')).toBeCloseTo(39846, 4);
  });
  it('=DATE(2020, 3, 0)', async () => {
    expect(await evaluate('=DATE(2020, 3, 0)')).toBeCloseTo(43890, 4);
  });
  it('=DATE(2020, 1, -5)', async () => {
    expect(await evaluate('=DATE(2020, 1, -5)')).toBeCloseTo(43825, 4);
  });
  it('=DATE(108, 1, 2)', async () => {
    expect(await evaluate('=DATE(108, 1, 2)')).toBeCloseTo(39449, 4);
  });
  it('=DATE(2020.9, 1.5, 15.9)', async () => {
    expect(await evaluate('=DATE(2020.9, 1.5, 15.9)')).toBeCloseTo(43845, 4);
  });
  it('=DATE(-1, 1, 1)', async () => {
    expect(await evaluate('=DATE(-1, 1, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DATE(10000, 1, 1)', async () => {
    expect(await evaluate('=DATE(10000, 1, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DATE("x", 1, 1)', async () => {
    expect(await evaluate('=DATE("x", 1, 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
