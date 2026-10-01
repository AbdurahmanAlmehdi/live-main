// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('XOR', () => {
  it('=XOR(TRUE, FALSE)', async () => {
    expect(await evaluate('=XOR(TRUE, FALSE)')).toBe(true);
  });
  it('=XOR(TRUE, TRUE)', async () => {
    expect(await evaluate('=XOR(TRUE, TRUE)')).toBe(false);
  });
  it('=XOR(TRUE, TRUE, TRUE)', async () => {
    expect(await evaluate('=XOR(TRUE, TRUE, TRUE)')).toBe(true);
  });
  it('=XOR({TRUE, FALSE, TRUE}, 1)', async () => {
    expect(await evaluate('=XOR({TRUE, FALSE, TRUE}, 1)')).toBe(true);
  });
  it('=XOR(0, 0)', async () => {
    expect(await evaluate('=XOR(0, 0)')).toBe(false);
  });
  it('=XOR({"x"})', async () => {
    expect(await evaluate('=XOR({"x"})')).toMatchObject({ code: '#VALUE!' });
  });
  it('=XOR(#N/A)', async () => {
    expect(await evaluate('=XOR(#N/A)')).toMatchObject({ code: '#N/A' });
  });
});
