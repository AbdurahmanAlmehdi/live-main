// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ISNUMBER', () => {
  it('=ISNUMBER(1)', async () => {
    expect(await evaluate('=ISNUMBER(1)')).toBe(true);
  });
  it('=ISNUMBER("1")', async () => {
    expect(await evaluate('=ISNUMBER("1")')).toBe(false);
  });
  it('=ISNUMBER(TRUE)', async () => {
    expect(await evaluate('=ISNUMBER(TRUE)')).toBe(false);
  });
  it('=ISNUMBER(#N/A)', async () => {
    expect(await evaluate('=ISNUMBER(#N/A)')).toBe(false);
  });
  it('=ISNUMBER(-0.5)', async () => {
    expect(await evaluate('=ISNUMBER(-0.5)')).toBe(true);
  });
});
