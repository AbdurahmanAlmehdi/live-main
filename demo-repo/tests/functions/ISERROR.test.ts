// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ISERROR', () => {
  it('=ISERROR(1/0)', async () => {
    expect(await evaluate('=ISERROR(1/0)')).toBe(true);
  });
  it('=ISERROR(#N/A)', async () => {
    expect(await evaluate('=ISERROR(#N/A)')).toBe(true);
  });
  it('=ISERROR(#REF!)', async () => {
    expect(await evaluate('=ISERROR(#REF!)')).toBe(true);
  });
  it('=ISERROR(1)', async () => {
    expect(await evaluate('=ISERROR(1)')).toBe(false);
  });
  it('=ISERROR("#N/A")', async () => {
    expect(await evaluate('=ISERROR("#N/A")')).toBe(false);
  });
});
