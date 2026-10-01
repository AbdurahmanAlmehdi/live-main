// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DB', () => {
  it('=DB(1000000, 100000, 6, 1, 7)', async () => {
    expect(await evaluate('=DB(1000000, 100000, 6, 1, 7)')).toBeCloseTo(186083.33333333334, 3);
  });
  it('=DB(1000000, 100000, 6, 2, 7)', async () => {
    expect(await evaluate('=DB(1000000, 100000, 6, 2, 7)')).toBeCloseTo(259639.41666666666, 3);
  });
  it('=DB(1000000, 100000, 6, 7, 7)', async () => {
    expect(await evaluate('=DB(1000000, 100000, 6, 7, 7)')).toBeCloseTo(15845.098473848071, 4);
  });
  it('=DB(10000, 1000, 5, 3)', async () => {
    expect(await evaluate('=DB(10000, 1000, 5, 3)')).toBeCloseTo(1469.2140900000002, 5);
  });
  it('=DB(1000000, 100000, 6, 7)', async () => {
    expect(await evaluate('=DB(1000000, 100000, 6, 7)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DB(1000, 100, 5, 0)', async () => {
    expect(await evaluate('=DB(1000, 100, 5, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DB(1000, 100, 5, 1, 13)', async () => {
    expect(await evaluate('=DB(1000, 100, 5, 1, 13)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DB(-1000, 100, 5, 1)', async () => {
    expect(await evaluate('=DB(-1000, 100, 5, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DB("x", 100, 5, 1)', async () => {
    expect(await evaluate('=DB("x", 100, 5, 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
