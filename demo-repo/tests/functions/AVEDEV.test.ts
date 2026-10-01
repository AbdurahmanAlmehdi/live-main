// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('AVEDEV', () => {
  it('=AVEDEV(4, 5, 6, 7, 5, 4, 3)', async () => {
    expect(await evaluate('=AVEDEV(4, 5, 6, 7, 5, 4, 3)')).toBeCloseTo(1.0204081632653061, 8);
  });
  it('=AVEDEV({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})', async () => {
    expect(await evaluate('=AVEDEV({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})')).toBeCloseTo(1.1600000000000001, 8);
  });
  it('=AVEDEV({1, "a", TRUE}, 3)', async () => {
    expect(await evaluate('=AVEDEV({1, "a", TRUE}, 3)')).toBeCloseTo(1, 9);
  });
  it('=AVEDEV(5)', async () => {
    expect(await evaluate('=AVEDEV(5)')).toBeCloseTo(0, 9);
  });
  it('=AVEDEV({"a"})', async () => {
    expect(await evaluate('=AVEDEV({"a"})')).toMatchObject({ code: '#NUM!' });
  });
  it('=AVEDEV(1, #N/A)', async () => {
    expect(await evaluate('=AVEDEV(1, #N/A)')).toMatchObject({ code: '#N/A' });
  });
});
