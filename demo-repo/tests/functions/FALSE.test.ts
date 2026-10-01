// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('FALSE', () => {
  it('=FALSE()', async () => {
    expect(await evaluate('=FALSE()')).toBe(false);
  });
  it('=FALSE()+1', async () => {
    expect(await evaluate('=FALSE()+1')).toBeCloseTo(1, 9);
  });
  it('=NOT(FALSE())', async () => {
    expect(await evaluate('=NOT(FALSE())')).toBe(true);
  });
  it('=IF(FALSE(), "y", "n")', async () => {
    expect(await evaluate('=IF(FALSE(), "y", "n")')).toBe('n');
  });
});
