// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('XLOOKUP', () => {
  it('=XLOOKUP("b", {"a", "b", "c"}, {1, 2, 3})', async () => {
    expect(await evaluate('=XLOOKUP("b", {"a", "b", "c"}, {1, 2, 3})')).toBeCloseTo(2, 8);
  });
  it('=XLOOKUP("B", {"a", "b", "c"}, {1, 2, 3})', async () => {
    expect(await evaluate('=XLOOKUP("B", {"a", "b", "c"}, {1, 2, 3})')).toBeCloseTo(2, 8);
  });
  it('=XLOOKUP("z", {"a", "b", "c"}, {1, 2, 3})', async () => {
    expect(await evaluate('=XLOOKUP("z", {"a", "b", "c"}, {1, 2, 3})')).toMatchObject({ code: '#N/A' });
  });
  it('=XLOOKUP("z", {"a", "b", "c"}, {1, 2, 3}, "none")', async () => {
    expect(await evaluate('=XLOOKUP("z", {"a", "b", "c"}, {1, 2, 3}, "none")')).toBe('none');
  });
  it('=XLOOKUP("b*", {"a", "bb", "b*"}, {1, 2, 3})', async () => {
    expect(await evaluate('=XLOOKUP("b*", {"a", "bb", "b*"}, {1, 2, 3})')).toBeCloseTo(3, 8);
  });
  it('=XLOOKUP("b*", {"a", "bb", "b*"}, {1, 2, 3}, "none", 2)', async () => {
    expect(await evaluate('=XLOOKUP("b*", {"a", "bb", "b*"}, {1, 2, 3}, "none", 2)')).toBeCloseTo(2, 8);
  });
  it('=XLOOKUP(25, {10, 20, 30}, {"x", "y", "z"}, "none", -1)', async () => {
    expect(await evaluate('=XLOOKUP(25, {10, 20, 30}, {"x", "y", "z"}, "none", -1)')).toBe('y');
  });
  it('=XLOOKUP(25, {10, 20, 30}, {"x", "y", "z"}, "none", 1)', async () => {
    expect(await evaluate('=XLOOKUP(25, {10, 20, 30}, {"x", "y", "z"}, "none", 1)')).toBe('z');
  });
  it('=XLOOKUP(2, {2, 1, 2}, {"first", "mid", "last"}, , 0, -1)', async () => {
    expect(await evaluate('=XLOOKUP(2, {2, 1, 2}, {"first", "mid", "last"}, , 0, -1)')).toBe('last');
  });
  it('=XLOOKUP(1, {1, 2}, {1, 2, 3})', async () => {
    expect(await evaluate('=XLOOKUP(1, {1, 2}, {1, 2, 3})')).toMatchObject({ code: '#VALUE!' });
  });
});
