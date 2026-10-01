// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('TEXTJOIN', () => {
  it('=TEXTJOIN(", ", TRUE, "a", "b", "c")', async () => {
    expect(await evaluate('=TEXTJOIN(", ", TRUE, "a", "b", "c")')).toBe('a, b, c');
  });
  it('=TEXTJOIN("-", TRUE, {"a", "", "b"})', async () => {
    expect(await evaluate('=TEXTJOIN("-", TRUE, {"a", "", "b"})')).toBe('a-b');
  });
  it('=TEXTJOIN("-", FALSE, {"a", "", "b"})', async () => {
    expect(await evaluate('=TEXTJOIN("-", FALSE, {"a", "", "b"})')).toBe('a--b');
  });
  it('=TEXTJOIN("", TRUE, 1, 2, 3)', async () => {
    expect(await evaluate('=TEXTJOIN("", TRUE, 1, 2, 3)')).toBe('123');
  });
  it('=TEXTJOIN(" ", TRUE, "x", TRUE)', async () => {
    expect(await evaluate('=TEXTJOIN(" ", TRUE, "x", TRUE)')).toBe('x TRUE');
  });
  it('=TEXTJOIN(",", TRUE, "a", #N/A)', async () => {
    expect(await evaluate('=TEXTJOIN(",", TRUE, "a", #N/A)')).toMatchObject({ code: '#N/A' });
  });
});
