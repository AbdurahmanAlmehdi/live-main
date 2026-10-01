// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('T', () => {
  it('=T("Rainfall")', async () => {
    expect(await evaluate('=T("Rainfall")')).toBe('Rainfall');
  });
  it('=T(19)', async () => {
    expect(await evaluate('=T(19)')).toBe('');
  });
  it('=T(TRUE)', async () => {
    expect(await evaluate('=T(TRUE)')).toBe('');
  });
  it('=T("")', async () => {
    expect(await evaluate('=T("")')).toBe('');
  });
  it('=T(#N/A)', async () => {
    expect(await evaluate('=T(#N/A)')).toMatchObject({ code: '#N/A' });
  });
});
