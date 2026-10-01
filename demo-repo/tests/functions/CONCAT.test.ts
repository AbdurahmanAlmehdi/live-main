// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('CONCAT', () => {
  it('=CONCAT("a", "b", "c")', async () => {
    expect(await evaluate('=CONCAT("a", "b", "c")')).toBe('abc');
  });
  it('=CONCAT({"x", "y"; "z", "w"})', async () => {
    expect(await evaluate('=CONCAT({"x", "y"; "z", "w"})')).toBe('xyzw');
  });
  it('=CONCAT(1, TRUE, "!")', async () => {
    expect(await evaluate('=CONCAT(1, TRUE, "!")')).toBe('1TRUE!');
  });
  it('=CONCAT("a", 1.5)', async () => {
    expect(await evaluate('=CONCAT("a", 1.5)')).toBe('a1.5');
  });
  it('=CONCAT("", "")', async () => {
    expect(await evaluate('=CONCAT("", "")')).toBe('');
  });
  it('=CONCAT("a", #N/A)', async () => {
    expect(await evaluate('=CONCAT("a", #N/A)')).toMatchObject({ code: '#N/A' });
  });
});
