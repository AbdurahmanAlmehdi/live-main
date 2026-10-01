// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('IMPRODUCT', () => {
  it('=IMPRODUCT("3+4i", "5-3i")', async () => {
    expect(await evaluate('=IMPRODUCT("3+4i", "5-3i")')).toBe('27+11i');
  });
  it('=IMPRODUCT("i", "i")', async () => {
    expect(await evaluate('=IMPRODUCT("i", "i")')).toBe('-1');
  });
  it('=IMPRODUCT("1+2j", 3)', async () => {
    expect(await evaluate('=IMPRODUCT("1+2j", 3)')).toBe('3+6j');
  });
  it('=IMPRODUCT("1+i", "1-i", "2")', async () => {
    expect(await evaluate('=IMPRODUCT("1+i", "1-i", "2")')).toBe('4');
  });
  it('=IMPRODUCT({"1+i", "1+i"})', async () => {
    expect(await evaluate('=IMPRODUCT({"1+i", "1+i"})')).toBe('2i');
  });
  it('=IMPRODUCT("1+i", "1+j")', async () => {
    expect(await evaluate('=IMPRODUCT("1+i", "1+j")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=IMPRODUCT("x")', async () => {
    expect(await evaluate('=IMPRODUCT("x")')).toMatchObject({ code: '#NUM!' });
  });
});
