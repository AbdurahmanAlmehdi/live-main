// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('KURT', () => {
  it('=KURT({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})', async () => {
    expect(await evaluate('=KURT({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})')).toBeCloseTo(-0.15179963720841538, 9);
  });
  it('=KURT(1, 2, 3, 10, 4)', async () => {
    expect(await evaluate('=KURT(1, 2, 3, 10, 4)')).toBeCloseTo(3.1519999999999975, 8);
  });
  it('=KURT({1, "a", 2, 9, 4})', async () => {
    expect(await evaluate('=KURT({1, "a", 2, 9, 4})')).toBeCloseTo(1.5, 8);
  });
  it('=KURT(1, 2, 3)', async () => {
    expect(await evaluate('=KURT(1, 2, 3)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=KURT(2, 2, 2, 2)', async () => {
    expect(await evaluate('=KURT(2, 2, 2, 2)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=KURT(1, #N/A, 3, 4)', async () => {
    expect(await evaluate('=KURT(1, #N/A, 3, 4)')).toMatchObject({ code: '#N/A' });
  });
});
