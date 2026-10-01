// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('OCT2HEX', () => {
  it('=OCT2HEX("100", 4)', async () => {
    expect(await evaluate('=OCT2HEX("100", 4)')).toBe('0040');
  });
  it('=OCT2HEX("7777777533")', async () => {
    expect(await evaluate('=OCT2HEX("7777777533")')).toBe('FFFFFFFF5B');
  });
  it('=OCT2HEX(17)', async () => {
    expect(await evaluate('=OCT2HEX(17)')).toBe('F');
  });
  it('=OCT2HEX("3777777777")', async () => {
    expect(await evaluate('=OCT2HEX("3777777777")')).toBe('1FFFFFFF');
  });
  it('=OCT2HEX("100", 1)', async () => {
    expect(await evaluate('=OCT2HEX("100", 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=OCT2HEX("9")', async () => {
    expect(await evaluate('=OCT2HEX("9")')).toMatchObject({ code: '#NUM!' });
  });
});
