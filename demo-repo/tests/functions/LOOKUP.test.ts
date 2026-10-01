// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('LOOKUP', () => {
  it('=LOOKUP(4.19, {4.14, 4.19, 5.17, 5.77, 6.39}, {"red", "orange", "yellow", "green", "blue"})', async () => {
    expect(await evaluate('=LOOKUP(4.19, {4.14, 4.19, 5.17, 5.77, 6.39}, {"red", "orange", "yellow", "green", "blue"})')).toBe('orange');
  });
  it('=LOOKUP(5, {4.14, 4.19, 5.17, 5.77, 6.39}, {"red", "orange", "yellow", "green", "blue"})', async () => {
    expect(await evaluate('=LOOKUP(5, {4.14, 4.19, 5.17, 5.77, 6.39}, {"red", "orange", "yellow", "green", "blue"})')).toBe('orange');
  });
  it('=LOOKUP(7.66, {4.14, 4.19, 5.17, 5.77, 6.39}, {"red", "orange", "yellow", "green", "blue"})', async () => {
    expect(await evaluate('=LOOKUP(7.66, {4.14, 4.19, 5.17, 5.77, 6.39}, {"red", "orange", "yellow", "green", "blue"})')).toBe('blue');
  });
  it('=LOOKUP(0, {4.14, 4.19, 5.17}, {"red", "orange", "yellow"})', async () => {
    expect(await evaluate('=LOOKUP(0, {4.14, 4.19, 5.17}, {"red", "orange", "yellow"})')).toMatchObject({ code: '#N/A' });
  });
  it('=LOOKUP(3, {1, 2, 3, 4})', async () => {
    expect(await evaluate('=LOOKUP(3, {1, 2, 3, 4})')).toBeCloseTo(3, 8);
  });
  it('=LOOKUP("c", {"a", "b", "d"}, {1, 2, 3})', async () => {
    expect(await evaluate('=LOOKUP("c", {"a", "b", "d"}, {1, 2, 3})')).toBeCloseTo(2, 8);
  });
});
