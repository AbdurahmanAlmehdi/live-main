// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('IMSUB', () => {
  it('=IMSUB("13+4i", "5+3i")', async () => {
    expect(await evaluate('=IMSUB("13+4i", "5+3i")')).toBe('8+i');
  });
  it('=IMSUB("1+j", "1+j")', async () => {
    expect(await evaluate('=IMSUB("1+j", "1+j")')).toBe('0');
  });
  it('=IMSUB("2", "i")', async () => {
    expect(await evaluate('=IMSUB("2", "i")')).toBe('2-i');
  });
  it('=IMSUB("1.5-2i", "-0.5+i")', async () => {
    expect(await evaluate('=IMSUB("1.5-2i", "-0.5+i")')).toBe('2-3i');
  });
  it('=IMSUB("1+i", "1+j")', async () => {
    expect(await evaluate('=IMSUB("1+i", "1+j")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=IMSUB("abc", "1")', async () => {
    expect(await evaluate('=IMSUB("abc", "1")')).toMatchObject({ code: '#NUM!' });
  });
});
