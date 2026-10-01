// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ISNONTEXT', () => {
  it('=ISNONTEXT(1)', async () => {
    expect(await evaluate('=ISNONTEXT(1)')).toBe(true);
  });
  it('=ISNONTEXT("x")', async () => {
    expect(await evaluate('=ISNONTEXT("x")')).toBe(false);
  });
  it('=ISNONTEXT("")', async () => {
    expect(await evaluate('=ISNONTEXT("")')).toBe(false);
  });
  it('=ISNONTEXT(#N/A)', async () => {
    expect(await evaluate('=ISNONTEXT(#N/A)')).toBe(true);
  });
  it('=ISNONTEXT(TRUE)', async () => {
    expect(await evaluate('=ISNONTEXT(TRUE)')).toBe(true);
  });
});
