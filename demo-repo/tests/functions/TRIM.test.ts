// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('TRIM', () => {
  it('=TRIM(" First Quarter   Earnings ")', async () => {
    expect(await evaluate('=TRIM(" First Quarter   Earnings ")')).toBe('First Quarter Earnings');
  });
  it('=TRIM("a  b")', async () => {
    expect(await evaluate('=TRIM("a  b")')).toBe('a b');
  });
  it('=TRIM("   ")', async () => {
    expect(await evaluate('=TRIM("   ")')).toBe('');
  });
  it('=TRIM(12)', async () => {
    expect(await evaluate('=TRIM(12)')).toBe('12');
  });
  it('=TRIM(#N/A)', async () => {
    expect(await evaluate('=TRIM(#N/A)')).toMatchObject({ code: '#N/A' });
  });
});
