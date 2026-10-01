// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('COUNT', () => {
  it('=COUNT(1, 2, 3)', async () => {
    expect(await evaluate('=COUNT(1, 2, 3)')).toBeCloseTo(3, 8);
  });
  it('=COUNT({1, "a", TRUE, 2})', async () => {
    expect(await evaluate('=COUNT({1, "a", TRUE, 2})')).toBeCloseTo(2, 8);
  });
  it('=COUNT("1", TRUE, "x")', async () => {
    expect(await evaluate('=COUNT("1", TRUE, "x")')).toBeCloseTo(2, 8);
  });
  it('=COUNT({#N/A, 1})', async () => {
    expect(await evaluate('=COUNT({#N/A, 1})')).toBeCloseTo(1, 9);
  });
  it('=COUNT()', async () => {
    expect(await evaluate('=COUNT()')).toBeCloseTo(0, 9);
  });
  it('=COUNT(#DIV/0!, 1)', async () => {
    expect(await evaluate('=COUNT(#DIV/0!, 1)')).toBeCloseTo(1, 9);
  });
});
