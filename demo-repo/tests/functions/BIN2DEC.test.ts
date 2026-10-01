// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('BIN2DEC', () => {
  it('=BIN2DEC("1100100")', async () => {
    expect(await evaluate('=BIN2DEC("1100100")')).toBeCloseTo(100, 7);
  });
  it('=BIN2DEC(1010)', async () => {
    expect(await evaluate('=BIN2DEC(1010)')).toBeCloseTo(10, 8);
  });
  it('=BIN2DEC("1111111111")', async () => {
    expect(await evaluate('=BIN2DEC("1111111111")')).toBeCloseTo(-1, 9);
  });
  it('=BIN2DEC("1000000000")', async () => {
    expect(await evaluate('=BIN2DEC("1000000000")')).toBeCloseTo(-512, 6);
  });
  it('=BIN2DEC("0")', async () => {
    expect(await evaluate('=BIN2DEC("0")')).toBeCloseTo(0, 9);
  });
  it('=BIN2DEC("")', async () => {
    expect(await evaluate('=BIN2DEC("")')).toBeCloseTo(0, 9);
  });
  it('=BIN2DEC("102")', async () => {
    expect(await evaluate('=BIN2DEC("102")')).toMatchObject({ code: '#NUM!' });
  });
  it('=BIN2DEC(TRUE)', async () => {
    expect(await evaluate('=BIN2DEC(TRUE)')).toMatchObject({ code: '#VALUE!' });
  });
  it('=BIN2DEC("11111111111")', async () => {
    expect(await evaluate('=BIN2DEC("11111111111")')).toMatchObject({ code: '#NUM!' });
  });
  it('=BIN2DEC(#N/A)', async () => {
    expect(await evaluate('=BIN2DEC(#N/A)')).toMatchObject({ code: '#N/A' });
  });
});
