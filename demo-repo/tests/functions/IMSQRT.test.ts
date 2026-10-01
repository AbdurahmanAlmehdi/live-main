// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('IMSQRT', () => {
  it('=IMSQRT("1+i")', async () => {
    expect(await evaluate('=IMSQRT("1+i")')).toBe('1.09868411346781+0.455089860562227i');
  });
  it('=IMSQRT("3+4i")', async () => {
    expect(await evaluate('=IMSQRT("3+4i")')).toBe('2+i');
  });
  it('=IMSQRT("4")', async () => {
    expect(await evaluate('=IMSQRT("4")')).toBe('2');
  });
  it('=IMSQRT("-4")', async () => {
    expect(await evaluate('=IMSQRT("-4")')).toBe('1.22464679914735E-16+2i');
  });
  it('=IMSQRT("2j")', async () => {
    expect(await evaluate('=IMSQRT("2j")')).toBe('1+j');
  });
  it('=IMSQRT("0")', async () => {
    expect(await evaluate('=IMSQRT("0")')).toBe('0');
  });
  it('=IMSQRT("abc")', async () => {
    expect(await evaluate('=IMSQRT("abc")')).toMatchObject({ code: '#NUM!' });
  });
});
