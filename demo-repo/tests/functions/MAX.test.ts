// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('MAX', () => {
  it('=MAX(10, 7, 9, 27, 2)', async () => {
    expect(await evaluate('=MAX(10, 7, 9, 27, 2)')).toBeCloseTo(27, 7);
  });
  it('=MAX({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})', async () => {
    expect(await evaluate('=MAX({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})')).toBeCloseTo(7, 8);
  });
  it('=MAX({1, "a", TRUE}, -3)', async () => {
    expect(await evaluate('=MAX({1, "a", TRUE}, -3)')).toBeCloseTo(1, 9);
  });
  it('=MAX("40", TRUE)', async () => {
    expect(await evaluate('=MAX("40", TRUE)')).toBeCloseTo(40, 7);
  });
  it('=MAX({"x"})', async () => {
    expect(await evaluate('=MAX({"x"})')).toBeCloseTo(0, 9);
  });
  it('=MAX(-5, -2)', async () => {
    expect(await evaluate('=MAX(-5, -2)')).toBeCloseTo(-2, 8);
  });
  it('=MAX(1, #N/A)', async () => {
    expect(await evaluate('=MAX(1, #N/A)')).toMatchObject({ code: '#N/A' });
  });
});
