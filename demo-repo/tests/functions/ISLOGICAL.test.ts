// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ISLOGICAL', () => {
  it('=ISLOGICAL(TRUE)', async () => {
    expect(await evaluate('=ISLOGICAL(TRUE)')).toBe(true);
  });
  it('=ISLOGICAL(1)', async () => {
    expect(await evaluate('=ISLOGICAL(1)')).toBe(false);
  });
  it('=ISLOGICAL("TRUE")', async () => {
    expect(await evaluate('=ISLOGICAL("TRUE")')).toBe(false);
  });
  it('=ISLOGICAL(#N/A)', async () => {
    expect(await evaluate('=ISLOGICAL(#N/A)')).toBe(false);
  });
});
