// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ISERR', () => {
  it('=ISERR(1/0)', async () => {
    expect(await evaluate('=ISERR(1/0)')).toBe(true);
  });
  it('=ISERR(#N/A)', async () => {
    expect(await evaluate('=ISERR(#N/A)')).toBe(false);
  });
  it('=ISERR(#VALUE!)', async () => {
    expect(await evaluate('=ISERR(#VALUE!)')).toBe(true);
  });
  it('=ISERR(1)', async () => {
    expect(await evaluate('=ISERR(1)')).toBe(false);
  });
  it('=ISERR("x")', async () => {
    expect(await evaluate('=ISERR("x")')).toBe(false);
  });
});
