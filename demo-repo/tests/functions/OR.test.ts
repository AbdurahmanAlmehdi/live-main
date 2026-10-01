// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('OR', () => {
  it('=OR(FALSE, TRUE)', async () => {
    expect(await evaluate('=OR(FALSE, TRUE)')).toBe(true);
  });
  it('=OR(FALSE, FALSE)', async () => {
    expect(await evaluate('=OR(FALSE, FALSE)')).toBe(false);
  });
  it('=OR(0, 0.5)', async () => {
    expect(await evaluate('=OR(0, 0.5)')).toBe(true);
  });
  it('=OR({FALSE, "x", TRUE})', async () => {
    expect(await evaluate('=OR({FALSE, "x", TRUE})')).toBe(true);
  });
  it('=OR({FALSE, FALSE}, FALSE)', async () => {
    expect(await evaluate('=OR({FALSE, FALSE}, FALSE)')).toBe(false);
  });
  it('=OR({"a"})', async () => {
    expect(await evaluate('=OR({"a"})')).toMatchObject({ code: '#VALUE!' });
  });
  it('=OR(#DIV/0!, TRUE)', async () => {
    expect(await evaluate('=OR(#DIV/0!, TRUE)')).toMatchObject({ code: '#DIV/0!' });
  });
});
