// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('BITAND', () => {
  it('=BITAND(13, 25)', async () => {
    expect(await evaluate('=BITAND(13, 25)')).toBeCloseTo(9, 8);
  });
  it('=BITAND(1, 5)', async () => {
    expect(await evaluate('=BITAND(1, 5)')).toBeCloseTo(1, 9);
  });
  it('=BITAND(0, 7)', async () => {
    expect(await evaluate('=BITAND(0, 7)')).toBeCloseTo(0, 9);
  });
  it('=BITAND(281474976710655, 4294967296)', async () => {
    expect(await evaluate('=BITAND(281474976710655, 4294967296)')).toBeCloseTo(4294967296, -1);
  });
  it('=BITAND("12", 10)', async () => {
    expect(await evaluate('=BITAND("12", 10)')).toBeCloseTo(8, 8);
  });
  it('=BITAND(1.5, 1)', async () => {
    expect(await evaluate('=BITAND(1.5, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BITAND(-1, 1)', async () => {
    expect(await evaluate('=BITAND(-1, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BITAND(281474976710656, 1)', async () => {
    expect(await evaluate('=BITAND(281474976710656, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BITAND("x", 1)', async () => {
    expect(await evaluate('=BITAND("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
