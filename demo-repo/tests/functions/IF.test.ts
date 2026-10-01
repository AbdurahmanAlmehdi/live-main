// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('IF', () => {
  it('=IF(TRUE, 1, 2)', async () => {
    expect(await evaluate('=IF(TRUE, 1, 2)')).toBeCloseTo(1, 9);
  });
  it('=IF(FALSE, 1, 2)', async () => {
    expect(await evaluate('=IF(FALSE, 1, 2)')).toBeCloseTo(2, 8);
  });
  it('=IF(1 > 2, "yes", "no")', async () => {
    expect(await evaluate('=IF(1 > 2, "yes", "no")')).toBe('no');
  });
  it('=IF(0, "a", "b")', async () => {
    expect(await evaluate('=IF(0, "a", "b")')).toBe('b');
  });
  it('=IF(FALSE, 1)', async () => {
    expect(await evaluate('=IF(FALSE, 1)')).toBe(false);
  });
  it('=IF(TRUE, , 2)', async () => {
    expect(await evaluate('=IF(TRUE, , 2)')).toBeCloseTo(0, 9);
  });
  it('=IF("x", 1, 2)', async () => {
    expect(await evaluate('=IF("x", 1, 2)')).toMatchObject({ code: '#VALUE!' });
  });
  it('=IF(#N/A, 1, 2)', async () => {
    expect(await evaluate('=IF(#N/A, 1, 2)')).toMatchObject({ code: '#N/A' });
  });
  it('=IF(TRUE, #DIV/0!, 1)', async () => {
    expect(await evaluate('=IF(TRUE, #DIV/0!, 1)')).toMatchObject({ code: '#DIV/0!' });
  });
});
