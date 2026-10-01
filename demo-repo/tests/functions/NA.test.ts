// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('NA', () => {
  it('=NA()', async () => {
    expect(await evaluate('=NA()')).toMatchObject({ code: '#N/A' });
  });
  it('=NA() + 1', async () => {
    expect(await evaluate('=NA() + 1')).toMatchObject({ code: '#N/A' });
  });
  it('=NA() * 0', async () => {
    expect(await evaluate('=NA() * 0')).toMatchObject({ code: '#N/A' });
  });
  it('=ISERROR(NA())', async () => {
    expect(await evaluate('=ISERROR(NA())')).toBe(true);
  });
});
