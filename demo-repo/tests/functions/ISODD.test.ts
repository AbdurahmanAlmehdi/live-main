// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ISODD', () => {
  it('=ISODD(3)', async () => {
    expect(await evaluate('=ISODD(3)')).toBe(true);
  });
  it('=ISODD(2)', async () => {
    expect(await evaluate('=ISODD(2)')).toBe(false);
  });
  it('=ISODD(-1)', async () => {
    expect(await evaluate('=ISODD(-1)')).toBe(true);
  });
  it('=ISODD(5.9)', async () => {
    expect(await evaluate('=ISODD(5.9)')).toBe(true);
  });
  it('=ISODD(0)', async () => {
    expect(await evaluate('=ISODD(0)')).toBe(false);
  });
  it('=ISODD("x")', async () => {
    expect(await evaluate('=ISODD("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
