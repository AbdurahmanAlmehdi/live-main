// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('HARMEAN', () => {
  it('=HARMEAN(4, 5, 8, 7, 11, 4, 3)', async () => {
    expect(await evaluate('=HARMEAN(4, 5, 8, 7, 11, 4, 3)')).toBeCloseTo(5.028375962061728, 8);
  });
  it('=HARMEAN({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})', async () => {
    expect(await evaluate('=HARMEAN({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})')).toBeCloseTo(3.807796917497734, 8);
  });
  it('=HARMEAN({2, "a", 8})', async () => {
    expect(await evaluate('=HARMEAN({2, "a", 8})')).toBeCloseTo(3.2, 8);
  });
  it('=HARMEAN(5)', async () => {
    expect(await evaluate('=HARMEAN(5)')).toBeCloseTo(5, 8);
  });
  it('=HARMEAN(1, 0)', async () => {
    expect(await evaluate('=HARMEAN(1, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=HARMEAN(1, -2)', async () => {
    expect(await evaluate('=HARMEAN(1, -2)')).toMatchObject({ code: '#NUM!' });
  });
});
