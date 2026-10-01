// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('OCT2BIN', () => {
  it('=OCT2BIN("3", 3)', async () => {
    expect(await evaluate('=OCT2BIN("3", 3)')).toBe('011');
  });
  it('=OCT2BIN("7777777000")', async () => {
    expect(await evaluate('=OCT2BIN("7777777000")')).toBe('1000000000');
  });
  it('=OCT2BIN(17)', async () => {
    expect(await evaluate('=OCT2BIN(17)')).toBe('1111');
  });
  it('=OCT2BIN("777")', async () => {
    expect(await evaluate('=OCT2BIN("777")')).toBe('111111111');
  });
  it('=OCT2BIN("1000")', async () => {
    expect(await evaluate('=OCT2BIN("1000")')).toMatchObject({ code: '#NUM!' });
  });
  it('=OCT2BIN("8")', async () => {
    expect(await evaluate('=OCT2BIN("8")')).toMatchObject({ code: '#NUM!' });
  });
});
