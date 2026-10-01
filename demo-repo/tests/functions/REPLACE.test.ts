// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('REPLACE', () => {
  it('=REPLACE("abcdefghijk", 6, 5, "*")', async () => {
    expect(await evaluate('=REPLACE("abcdefghijk", 6, 5, "*")')).toBe('abcde*k');
  });
  it('=REPLACE("2009", 3, 2, "10")', async () => {
    expect(await evaluate('=REPLACE("2009", 3, 2, "10")')).toBe('2010');
  });
  it('=REPLACE("123456", 1, 3, "@")', async () => {
    expect(await evaluate('=REPLACE("123456", 1, 3, "@")')).toBe('@456');
  });
  it('=REPLACE("abc", 10, 1, "Z")', async () => {
    expect(await evaluate('=REPLACE("abc", 10, 1, "Z")')).toBe('abcZ');
  });
  it('=REPLACE("abc", 0, 1, "Z")', async () => {
    expect(await evaluate('=REPLACE("abc", 0, 1, "Z")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=REPLACE("abc", 1, -1, "Z")', async () => {
    expect(await evaluate('=REPLACE("abc", 1, -1, "Z")')).toMatchObject({ code: '#VALUE!' });
  });
});
