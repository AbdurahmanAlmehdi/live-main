// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ISNA', () => {
  it('=ISNA(#N/A)', async () => {
    expect(await evaluate('=ISNA(#N/A)')).toBe(true);
  });
  it('=ISNA(NA())', async () => {
    expect(await evaluate('=ISNA(NA())')).toBe(true);
  });
  it('=ISNA(1/0)', async () => {
    expect(await evaluate('=ISNA(1/0)')).toBe(false);
  });
  it('=ISNA(1)', async () => {
    expect(await evaluate('=ISNA(1)')).toBe(false);
  });
});
