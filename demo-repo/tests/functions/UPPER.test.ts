// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('UPPER', () => {
  it('=UPPER("total")', async () => {
    expect(await evaluate('=UPPER("total")')).toBe('TOTAL');
  });
  it('=UPPER("Yield 1a")', async () => {
    expect(await evaluate('=UPPER("Yield 1a")')).toBe('YIELD 1A');
  });
  it('=UPPER(123)', async () => {
    expect(await evaluate('=UPPER(123)')).toBe('123');
  });
  it('=UPPER("")', async () => {
    expect(await evaluate('=UPPER("")')).toBe('');
  });
  it('=UPPER(#N/A)', async () => {
    expect(await evaluate('=UPPER(#N/A)')).toMatchObject({ code: '#N/A' });
  });
});
