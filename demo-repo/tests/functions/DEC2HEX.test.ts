// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DEC2HEX', () => {
  it('=DEC2HEX(100, 4)', async () => {
    expect(await evaluate('=DEC2HEX(100, 4)')).toBe('0064');
  });
  it('=DEC2HEX(255)', async () => {
    expect(await evaluate('=DEC2HEX(255)')).toBe('FF');
  });
  it('=DEC2HEX(-54)', async () => {
    expect(await evaluate('=DEC2HEX(-54)')).toBe('FFFFFFFFCA');
  });
  it('=DEC2HEX(28)', async () => {
    expect(await evaluate('=DEC2HEX(28)')).toBe('1C');
  });
  it('=DEC2HEX(549755813887)', async () => {
    expect(await evaluate('=DEC2HEX(549755813887)')).toBe('7FFFFFFFFF');
  });
  it('=DEC2HEX(-549755813888)', async () => {
    expect(await evaluate('=DEC2HEX(-549755813888)')).toBe('8000000000');
  });
  it('=DEC2HEX(549755813888)', async () => {
    expect(await evaluate('=DEC2HEX(549755813888)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DEC2HEX(64, 1)', async () => {
    expect(await evaluate('=DEC2HEX(64, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DEC2HEX(TRUE)', async () => {
    expect(await evaluate('=DEC2HEX(TRUE)')).toMatchObject({ code: '#VALUE!' });
  });
  it('=DEC2HEX("x")', async () => {
    expect(await evaluate('=DEC2HEX("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
