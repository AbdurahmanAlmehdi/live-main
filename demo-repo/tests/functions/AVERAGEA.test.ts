// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('AVERAGEA', () => {
  it('=AVERAGEA(10, 7, 9, 2)', async () => {
    expect(await evaluate('=AVERAGEA(10, 7, 9, 2)')).toBeCloseTo(7, 8);
  });
  it('=AVERAGEA({1, "a", TRUE}, 3)', async () => {
    expect(await evaluate('=AVERAGEA({1, "a", TRUE}, 3)')).toBeCloseTo(1.25, 8);
  });
  it('=AVERAGEA({2, FALSE})', async () => {
    expect(await evaluate('=AVERAGEA({2, FALSE})')).toBeCloseTo(1, 9);
  });
  it('=AVERAGEA("4", TRUE)', async () => {
    expect(await evaluate('=AVERAGEA("4", TRUE)')).toBeCloseTo(2.5, 8);
  });
  it('=AVERAGEA({"x", "y", 6})', async () => {
    expect(await evaluate('=AVERAGEA({"x", "y", 6})')).toBeCloseTo(2, 8);
  });
  it('=AVERAGEA(1, "abc")', async () => {
    expect(await evaluate('=AVERAGEA(1, "abc")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=AVERAGEA({1, #DIV/0!})', async () => {
    expect(await evaluate('=AVERAGEA({1, #DIV/0!})')).toMatchObject({ code: '#DIV/0!' });
  });
});
