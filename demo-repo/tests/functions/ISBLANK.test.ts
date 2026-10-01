// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ISBLANK', () => {
  it('=ISBLANK(1)', async () => {
    expect(await evaluate('=ISBLANK(1)')).toBe(false);
  });
  it('=ISBLANK("")', async () => {
    expect(await evaluate('=ISBLANK("")')).toBe(false);
  });
  it('=ISBLANK(FALSE)', async () => {
    expect(await evaluate('=ISBLANK(FALSE)')).toBe(false);
  });
  it('=ISBLANK(#N/A)', async () => {
    expect(await evaluate('=ISBLANK(#N/A)')).toBe(false);
  });
  it('=ISBLANK(,)', async () => {
    expect(await evaluate('=ISBLANK(,)')).toMatchObject({ code: '#N/A' });
  });
});
