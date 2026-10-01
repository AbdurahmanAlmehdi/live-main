// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('IMSUM', () => {
  it('=IMSUM("3+4i", "5-3i")', async () => {
    expect(await evaluate('=IMSUM("3+4i", "5-3i")')).toBe('8+i');
  });
  it('=IMSUM("1+j", "2-j")', async () => {
    expect(await evaluate('=IMSUM("1+j", "2-j")')).toBe('3');
  });
  it('=IMSUM("i", "i", "i")', async () => {
    expect(await evaluate('=IMSUM("i", "i", "i")')).toBe('3i');
  });
  it('=IMSUM(1, "2.5+0.5i")', async () => {
    expect(await evaluate('=IMSUM(1, "2.5+0.5i")')).toBe('3.5+0.5i');
  });
  it('=IMSUM({"1+i", "2+2i"}, "3")', async () => {
    expect(await evaluate('=IMSUM({"1+i", "2+2i"}, "3")')).toBe('6+3i');
  });
  it('=IMSUM("1+i", "1+j")', async () => {
    expect(await evaluate('=IMSUM("1+i", "1+j")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=IMSUM("1+x")', async () => {
    expect(await evaluate('=IMSUM("1+x")')).toMatchObject({ code: '#NUM!' });
  });
});
