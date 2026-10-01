// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('BIN2HEX', () => {
  it('=BIN2HEX("11111011", 4)', async () => {
    expect(await evaluate('=BIN2HEX("11111011", 4)')).toBe('00FB');
  });
  it('=BIN2HEX("1110")', async () => {
    expect(await evaluate('=BIN2HEX("1110")')).toBe('E');
  });
  it('=BIN2HEX("1111111111")', async () => {
    expect(await evaluate('=BIN2HEX("1111111111")')).toBe('FFFFFFFFFF');
  });
  it('=BIN2HEX(101, 3.9)', async () => {
    expect(await evaluate('=BIN2HEX(101, 3.9)')).toBe('005');
  });
  it('=BIN2HEX("11111011", 1)', async () => {
    expect(await evaluate('=BIN2HEX("11111011", 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BIN2HEX("12")', async () => {
    expect(await evaluate('=BIN2HEX("12")')).toMatchObject({ code: '#NUM!' });
  });
  it('=BIN2HEX("1", -1)', async () => {
    expect(await evaluate('=BIN2HEX("1", -1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BIN2HEX("1", "x")', async () => {
    expect(await evaluate('=BIN2HEX("1", "x")')).toMatchObject({ code: '#VALUE!' });
  });
});
