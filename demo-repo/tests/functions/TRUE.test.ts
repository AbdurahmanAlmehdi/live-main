// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('TRUE', () => {
  it('=TRUE()', async () => {
    expect(await evaluate('=TRUE()')).toBe(true);
  });
  it('=TRUE()+1', async () => {
    expect(await evaluate('=TRUE()+1')).toBeCloseTo(2, 8);
  });
  it('=NOT(TRUE())', async () => {
    expect(await evaluate('=NOT(TRUE())')).toBe(false);
  });
  it('=IF(TRUE(), "y", "n")', async () => {
    expect(await evaluate('=IF(TRUE(), "y", "n")')).toBe('y');
  });
});
