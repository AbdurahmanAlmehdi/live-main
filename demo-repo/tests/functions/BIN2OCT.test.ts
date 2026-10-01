// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('BIN2OCT', () => {
  it('=BIN2OCT("1001", 3)', async () => {
    expect(await evaluate('=BIN2OCT("1001", 3)')).toBe('011');
  });
  it('=BIN2OCT("1100100")', async () => {
    expect(await evaluate('=BIN2OCT("1100100")')).toBe('144');
  });
  it('=BIN2OCT("1111111111")', async () => {
    expect(await evaluate('=BIN2OCT("1111111111")')).toBe('7777777777');
  });
  it('=BIN2OCT(111)', async () => {
    expect(await evaluate('=BIN2OCT(111)')).toBe('7');
  });
  it('=BIN2OCT("1001", 1)', async () => {
    expect(await evaluate('=BIN2OCT("1001", 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BIN2OCT("2")', async () => {
    expect(await evaluate('=BIN2OCT("2")')).toMatchObject({ code: '#NUM!' });
  });
});
