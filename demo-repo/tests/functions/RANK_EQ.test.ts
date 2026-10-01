// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('RANK.EQ', () => {
  it('=RANK.EQ(7, {7, 3.5, 3.5, 1, 2}, 1)', async () => {
    expect(await evaluate('=RANK.EQ(7, {7, 3.5, 3.5, 1, 2}, 1)')).toBeCloseTo(5, 8);
  });
  it('=RANK.EQ(2, {7, 3.5, 3.5, 1, 2})', async () => {
    expect(await evaluate('=RANK.EQ(2, {7, 3.5, 3.5, 1, 2})')).toBeCloseTo(4, 8);
  });
  it('=RANK.EQ(3.5, {7, 3.5, 3.5, 1, 2})', async () => {
    expect(await evaluate('=RANK.EQ(3.5, {7, 3.5, 3.5, 1, 2})')).toBeCloseTo(2, 8);
  });
  it('=RANK.EQ(3.5, {7, 3.5, 3.5, 1, 2}, 1)', async () => {
    expect(await evaluate('=RANK.EQ(3.5, {7, 3.5, 3.5, 1, 2}, 1)')).toBeCloseTo(3, 8);
  });
  it('=RANK.EQ(4, {7, 3.5, 3.5, 1, 2})', async () => {
    expect(await evaluate('=RANK.EQ(4, {7, 3.5, 3.5, 1, 2})')).toMatchObject({ code: '#N/A' });
  });
  it('=RANK.EQ(1, {1, "a", 3})', async () => {
    expect(await evaluate('=RANK.EQ(1, {1, "a", 3})')).toBeCloseTo(2, 8);
  });
});
