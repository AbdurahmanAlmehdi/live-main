// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('AND', () => {
  it('=AND(TRUE, TRUE)', async () => {
    expect(await evaluate('=AND(TRUE, TRUE)')).toBe(true);
  });
  it('=AND(TRUE, FALSE)', async () => {
    expect(await evaluate('=AND(TRUE, FALSE)')).toBe(false);
  });
  it('=AND(1, 2)', async () => {
    expect(await evaluate('=AND(1, 2)')).toBe(true);
  });
  it('=AND(0, TRUE)', async () => {
    expect(await evaluate('=AND(0, TRUE)')).toBe(false);
  });
  it('=AND({TRUE, TRUE, "x"})', async () => {
    expect(await evaluate('=AND({TRUE, TRUE, "x"})')).toBe(true);
  });
  it('=AND({TRUE, FALSE}, TRUE)', async () => {
    expect(await evaluate('=AND({TRUE, FALSE}, TRUE)')).toBe(false);
  });
  it('=AND({"a", "b"})', async () => {
    expect(await evaluate('=AND({"a", "b"})')).toMatchObject({ code: '#VALUE!' });
  });
  it('=AND(TRUE, #N/A)', async () => {
    expect(await evaluate('=AND(TRUE, #N/A)')).toMatchObject({ code: '#N/A' });
  });
});
