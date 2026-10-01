// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('IMDIV', () => {
  it('=IMDIV("-238+240i", "10+24i")', async () => {
    expect(await evaluate('=IMDIV("-238+240i", "10+24i")')).toBe('5+12i');
  });
  it('=IMDIV("1", "i")', async () => {
    expect(await evaluate('=IMDIV("1", "i")')).toBe('-i');
  });
  it('=IMDIV("4+2j", "2")', async () => {
    expect(await evaluate('=IMDIV("4+2j", "2")')).toBe('2+j');
  });
  it('=IMDIV("1+i", "1-i")', async () => {
    expect(await evaluate('=IMDIV("1+i", "1-i")')).toBe('i');
  });
  it('=IMDIV("1+i", "0")', async () => {
    expect(await evaluate('=IMDIV("1+i", "0")')).toMatchObject({ code: '#NUM!' });
  });
  it('=IMDIV("1+i", "1+j")', async () => {
    expect(await evaluate('=IMDIV("1+i", "1+j")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=IMDIV("abc", "1")', async () => {
    expect(await evaluate('=IMDIV("abc", "1")')).toMatchObject({ code: '#NUM!' });
  });
});
