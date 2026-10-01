// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ROWS', () => {
  it('=ROWS({1, 2, 3})', async () => {
    expect(await evaluate('=ROWS({1, 2, 3})')).toBeCloseTo(1, 9);
  });
  it('=ROWS({1; 2; 3})', async () => {
    expect(await evaluate('=ROWS({1; 2; 3})')).toBeCloseTo(3, 8);
  });
  it('=ROWS({1, 2; 3, 4; 5, 6})', async () => {
    expect(await evaluate('=ROWS({1, 2; 3, 4; 5, 6})')).toBeCloseTo(3, 8);
  });
  it('=ROWS(5)', async () => {
    expect(await evaluate('=ROWS(5)')).toBeCloseTo(1, 9);
  });
});
