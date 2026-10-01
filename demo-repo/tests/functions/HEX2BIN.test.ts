// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('HEX2BIN', () => {
  it('=HEX2BIN("F", 8)', async () => {
    expect(await evaluate('=HEX2BIN("F", 8)')).toBe('00001111');
  });
  it('=HEX2BIN("B7")', async () => {
    expect(await evaluate('=HEX2BIN("B7")')).toBe('10110111');
  });
  it('=HEX2BIN("FFFFFFFE00")', async () => {
    expect(await evaluate('=HEX2BIN("FFFFFFFE00")')).toBe('1000000000');
  });
  it('=HEX2BIN("1FF")', async () => {
    expect(await evaluate('=HEX2BIN("1FF")')).toBe('111111111');
  });
  it('=HEX2BIN("200")', async () => {
    expect(await evaluate('=HEX2BIN("200")')).toMatchObject({ code: '#NUM!' });
  });
  it('=HEX2BIN("G")', async () => {
    expect(await evaluate('=HEX2BIN("G")')).toMatchObject({ code: '#NUM!' });
  });
  it('=HEX2BIN("F", 2)', async () => {
    expect(await evaluate('=HEX2BIN("F", 2)')).toMatchObject({ code: '#NUM!' });
  });
});
