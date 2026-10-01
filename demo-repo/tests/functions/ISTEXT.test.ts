// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ISTEXT', () => {
  it('=ISTEXT("x")', async () => {
    expect(await evaluate('=ISTEXT("x")')).toBe(true);
  });
  it('=ISTEXT("")', async () => {
    expect(await evaluate('=ISTEXT("")')).toBe(true);
  });
  it('=ISTEXT(1)', async () => {
    expect(await evaluate('=ISTEXT(1)')).toBe(false);
  });
  it('=ISTEXT(#N/A)', async () => {
    expect(await evaluate('=ISTEXT(#N/A)')).toBe(false);
  });
  it('=ISTEXT(TRUE)', async () => {
    expect(await evaluate('=ISTEXT(TRUE)')).toBe(false);
  });
});
