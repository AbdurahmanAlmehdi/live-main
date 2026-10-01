// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('RANK.AVG', () => {
  it('=RANK.AVG(94, {89, 88, 92, 101, 94, 97, 95})', async () => {
    expect(await evaluate('=RANK.AVG(94, {89, 88, 92, 101, 94, 97, 95})')).toBeCloseTo(4, 8);
  });
  it('=RANK.AVG(3.5, {7, 3.5, 3.5, 1, 2})', async () => {
    expect(await evaluate('=RANK.AVG(3.5, {7, 3.5, 3.5, 1, 2})')).toBeCloseTo(2.5, 8);
  });
  it('=RANK.AVG(3.5, {7, 3.5, 3.5, 1, 2}, 1)', async () => {
    expect(await evaluate('=RANK.AVG(3.5, {7, 3.5, 3.5, 1, 2}, 1)')).toBeCloseTo(3.5, 8);
  });
  it('=RANK.AVG(2, {2, 2, 2})', async () => {
    expect(await evaluate('=RANK.AVG(2, {2, 2, 2})')).toBeCloseTo(2, 8);
  });
  it('=RANK.AVG(7, {7, 3.5, 3.5, 1, 2}, 1)', async () => {
    expect(await evaluate('=RANK.AVG(7, {7, 3.5, 3.5, 1, 2}, 1)')).toBeCloseTo(5, 8);
  });
  it('=RANK.AVG(4, {7, 3.5, 3.5, 1, 2})', async () => {
    expect(await evaluate('=RANK.AVG(4, {7, 3.5, 3.5, 1, 2})')).toMatchObject({ code: '#N/A' });
  });
});
