// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('MATCH', () => {
  it('=MATCH(39, {25, 38, 40, 41}, 1)', async () => {
    expect(await evaluate('=MATCH(39, {25, 38, 40, 41}, 1)')).toBeCloseTo(2, 8);
  });
  it('=MATCH(41, {25, 38, 40, 41}, 0)', async () => {
    expect(await evaluate('=MATCH(41, {25, 38, 40, 41}, 0)')).toBeCloseTo(4, 8);
  });
  it('=MATCH(40, {41, 40, 38, 25}, -1)', async () => {
    expect(await evaluate('=MATCH(40, {41, 40, 38, 25}, -1)')).toBeCloseTo(2, 8);
  });
  it('=MATCH("b*", {"apple", "banana", "cherry"}, 0)', async () => {
    expect(await evaluate('=MATCH("b*", {"apple", "banana", "cherry"}, 0)')).toBeCloseTo(2, 8);
  });
  it('=MATCH("CHERRY", {"apple", "banana", "cherry"}, 0)', async () => {
    expect(await evaluate('=MATCH("CHERRY", {"apple", "banana", "cherry"}, 0)')).toBeCloseTo(3, 8);
  });
  it('=MATCH(25, {25, 38, 40, 41})', async () => {
    expect(await evaluate('=MATCH(25, {25, 38, 40, 41})')).toBeCloseTo(1, 9);
  });
  it('=MATCH(10, {25, 38, 40, 41}, 1)', async () => {
    expect(await evaluate('=MATCH(10, {25, 38, 40, 41}, 1)')).toMatchObject({ code: '#N/A' });
  });
  it('=MATCH("x", {"apple", "banana"}, 0)', async () => {
    expect(await evaluate('=MATCH("x", {"apple", "banana"}, 0)')).toMatchObject({ code: '#N/A' });
  });
});
