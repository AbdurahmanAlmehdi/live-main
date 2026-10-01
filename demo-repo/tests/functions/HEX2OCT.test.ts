// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('HEX2OCT', () => {
  it('=HEX2OCT("F", 3)', async () => {
    expect(await evaluate('=HEX2OCT("F", 3)')).toBe('017');
  });
  it('=HEX2OCT("3B4E")', async () => {
    expect(await evaluate('=HEX2OCT("3B4E")')).toBe('35516');
  });
  it('=HEX2OCT("FFFFFFFF00")', async () => {
    expect(await evaluate('=HEX2OCT("FFFFFFFF00")')).toBe('7777777400');
  });
  it('=HEX2OCT("1FFFFFFF")', async () => {
    expect(await evaluate('=HEX2OCT("1FFFFFFF")')).toBe('3777777777');
  });
  it('=HEX2OCT("20000000")', async () => {
    expect(await evaluate('=HEX2OCT("20000000")')).toMatchObject({ code: '#NUM!' });
  });
  it('=HEX2OCT("Z")', async () => {
    expect(await evaluate('=HEX2OCT("Z")')).toMatchObject({ code: '#NUM!' });
  });
});
