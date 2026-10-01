// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('MODE.SNGL', () => {
  it('=MODE.SNGL(5.6, 4, 4, 3, 2, 4)', async () => {
    expect(await evaluate('=MODE.SNGL(5.6, 4, 4, 3, 2, 4)')).toBeCloseTo(4, 8);
  });
  it('=MODE.SNGL({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})', async () => {
    expect(await evaluate('=MODE.SNGL({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})')).toBeCloseTo(4, 8);
  });
  it('=MODE.SNGL({1, 2, 2, 1})', async () => {
    expect(await evaluate('=MODE.SNGL({1, 2, 2, 1})')).toBeCloseTo(1, 9);
  });
  it('=MODE.SNGL({1, "a", "a", 3, 3})', async () => {
    expect(await evaluate('=MODE.SNGL({1, "a", "a", 3, 3})')).toBeCloseTo(3, 8);
  });
  it('=MODE.SNGL(1, 2, 3)', async () => {
    expect(await evaluate('=MODE.SNGL(1, 2, 3)')).toMatchObject({ code: '#N/A' });
  });
  it('=MODE.SNGL(1, #N/A)', async () => {
    expect(await evaluate('=MODE.SNGL(1, #N/A)')).toMatchObject({ code: '#N/A' });
  });
});
