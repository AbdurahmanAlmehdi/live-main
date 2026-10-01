// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ARABIC', () => {
  it('=ARABIC("MCMXCIX")', async () => {
    expect(await evaluate('=ARABIC("MCMXCIX")')).toBeCloseTo(1999, 5);
  });
  it('=ARABIC("mmxxiv")', async () => {
    expect(await evaluate('=ARABIC("mmxxiv")')).toBeCloseTo(2024, 5);
  });
  it('=ARABIC("IV")', async () => {
    expect(await evaluate('=ARABIC("IV")')).toBeCloseTo(4, 8);
  });
  it('=ARABIC("")', async () => {
    expect(await evaluate('=ARABIC("")')).toBeCloseTo(0, 9);
  });
  it('=ARABIC("-XL")', async () => {
    expect(await evaluate('=ARABIC("-XL")')).toBeCloseTo(-40, 7);
  });
  it('=ARABIC("ABC")', async () => {
    expect(await evaluate('=ARABIC("ABC")')).toMatchObject({ code: '#VALUE!' });
  });
});
