// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('IMCONJUGATE', () => {
  it('=IMCONJUGATE("3+4i")', async () => {
    expect(await evaluate('=IMCONJUGATE("3+4i")')).toBe('3-4i');
  });
  it('=IMCONJUGATE("1-j")', async () => {
    expect(await evaluate('=IMCONJUGATE("1-j")')).toBe('1+j');
  });
  it('=IMCONJUGATE("-2i")', async () => {
    expect(await evaluate('=IMCONJUGATE("-2i")')).toBe('2i');
  });
  it('=IMCONJUGATE("5")', async () => {
    expect(await evaluate('=IMCONJUGATE("5")')).toBe('5');
  });
  it('=IMCONJUGATE("i")', async () => {
    expect(await evaluate('=IMCONJUGATE("i")')).toBe('-i');
  });
  it('=IMCONJUGATE("3+4")', async () => {
    expect(await evaluate('=IMCONJUGATE("3+4")')).toMatchObject({ code: '#NUM!' });
  });
});
