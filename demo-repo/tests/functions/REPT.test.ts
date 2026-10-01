// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('REPT', () => {
  it('=REPT("*-", 3)', async () => {
    expect(await evaluate('=REPT("*-", 3)')).toBe('*-*-*-');
  });
  it('=REPT("-", 10)', async () => {
    expect(await evaluate('=REPT("-", 10)')).toBe('----------');
  });
  it('=REPT("ab", 0)', async () => {
    expect(await evaluate('=REPT("ab", 0)')).toBe('');
  });
  it('=REPT("ab", 2.9)', async () => {
    expect(await evaluate('=REPT("ab", 2.9)')).toBe('abab');
  });
  it('=REPT(1, 3)', async () => {
    expect(await evaluate('=REPT(1, 3)')).toBe('111');
  });
  it('=REPT("x", -1)', async () => {
    expect(await evaluate('=REPT("x", -1)')).toMatchObject({ code: '#VALUE!' });
  });
});
