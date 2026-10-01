// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ISEVEN', () => {
  it('=ISEVEN(2)', async () => {
    expect(await evaluate('=ISEVEN(2)')).toBe(true);
  });
  it('=ISEVEN(3)', async () => {
    expect(await evaluate('=ISEVEN(3)')).toBe(false);
  });
  it('=ISEVEN(-1)', async () => {
    expect(await evaluate('=ISEVEN(-1)')).toBe(false);
  });
  it('=ISEVEN(2.5)', async () => {
    expect(await evaluate('=ISEVEN(2.5)')).toBe(true);
  });
  it('=ISEVEN(0)', async () => {
    expect(await evaluate('=ISEVEN(0)')).toBe(true);
  });
  it('=ISEVEN("x")', async () => {
    expect(await evaluate('=ISEVEN("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
