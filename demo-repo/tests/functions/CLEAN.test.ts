// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('CLEAN', () => {
  it('=CLEAN("a"&CHAR(9)&"b")', async () => {
    expect(await evaluate('=CLEAN("a"&CHAR(9)&"b")')).toBe('ab');
  });
  it('=CLEAN("plain")', async () => {
    expect(await evaluate('=CLEAN("plain")')).toBe('plain');
  });
  it('=CLEAN(CHAR(7)&"x"&CHAR(10))', async () => {
    expect(await evaluate('=CLEAN(CHAR(7)&"x"&CHAR(10))')).toBe('x');
  });
  it('=CLEAN(123)', async () => {
    expect(await evaluate('=CLEAN(123)')).toBe('123');
  });
  it('=CLEAN(#N/A)', async () => {
    expect(await evaluate('=CLEAN(#N/A)')).toMatchObject({ code: '#N/A' });
  });
});
