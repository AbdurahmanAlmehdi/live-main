// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DEVSQ', () => {
  it('=DEVSQ(4, 5, 8, 7, 11, 4, 3)', async () => {
    expect(await evaluate('=DEVSQ(4, 5, 8, 7, 11, 4, 3)')).toBeCloseTo(48, 7);
  });
  it('=DEVSQ({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})', async () => {
    expect(await evaluate('=DEVSQ({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})')).toBeCloseTo(20.1, 7);
  });
  it('=DEVSQ({1, "a", TRUE}, 3)', async () => {
    expect(await evaluate('=DEVSQ({1, "a", TRUE}, 3)')).toBeCloseTo(2, 8);
  });
  it('=DEVSQ(5)', async () => {
    expect(await evaluate('=DEVSQ(5)')).toBeCloseTo(0, 9);
  });
  it('=DEVSQ({"a"})', async () => {
    expect(await evaluate('=DEVSQ({"a"})')).toMatchObject({ code: '#NUM!' });
  });
  it('=DEVSQ(1, #N/A)', async () => {
    expect(await evaluate('=DEVSQ(1, #N/A)')).toMatchObject({ code: '#N/A' });
  });
});
