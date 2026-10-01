// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('LOWER', () => {
  it('=LOWER("E. E. Cummings")', async () => {
    expect(await evaluate('=LOWER("E. E. Cummings")')).toBe('e. e. cummings');
  });
  it('=LOWER("Apt. 2B")', async () => {
    expect(await evaluate('=LOWER("Apt. 2B")')).toBe('apt. 2b');
  });
  it('=LOWER(123)', async () => {
    expect(await evaluate('=LOWER(123)')).toBe('123');
  });
  it('=LOWER(TRUE)', async () => {
    expect(await evaluate('=LOWER(TRUE)')).toBe('true');
  });
  it('=LOWER(#N/A)', async () => {
    expect(await evaluate('=LOWER(#N/A)')).toMatchObject({ code: '#N/A' });
  });
});
