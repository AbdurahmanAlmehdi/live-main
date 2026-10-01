// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('HLOOKUP', () => {
  it('=HLOOKUP("b", {"a", "b", "c"; 1, 2, 3}, 2, FALSE)', async () => {
    expect(await evaluate('=HLOOKUP("b", {"a", "b", "c"; 1, 2, 3}, 2, FALSE)')).toBeCloseTo(2, 8);
  });
  it('=HLOOKUP("C", {"a", "b", "c"; 1, 2, 3; 4, 5, 6}, 3, FALSE)', async () => {
    expect(await evaluate('=HLOOKUP("C", {"a", "b", "c"; 1, 2, 3; 4, 5, 6}, 3, FALSE)')).toBeCloseTo(6, 8);
  });
  it('=HLOOKUP("b?", {"a1", "b2", "c3"; 1, 2, 3}, 2, FALSE)', async () => {
    expect(await evaluate('=HLOOKUP("b?", {"a1", "b2", "c3"; 1, 2, 3}, 2, FALSE)')).toBeCloseTo(2, 8);
  });
  it('=HLOOKUP(25, {10, 20, 30; "x", "y", "z"}, 2)', async () => {
    expect(await evaluate('=HLOOKUP(25, {10, 20, 30; "x", "y", "z"}, 2)')).toBe('y');
  });
  it('=HLOOKUP("q", {"a", "b"; 1, 2}, 2, FALSE)', async () => {
    expect(await evaluate('=HLOOKUP("q", {"a", "b"; 1, 2}, 2, FALSE)')).toMatchObject({ code: '#N/A' });
  });
  it('=HLOOKUP(5, {10, 20; 1, 2}, 2, TRUE)', async () => {
    expect(await evaluate('=HLOOKUP(5, {10, 20; 1, 2}, 2, TRUE)')).toMatchObject({ code: '#N/A' });
  });
  it('=HLOOKUP("a", {"a", "b"; 1, 2}, 3, FALSE)', async () => {
    expect(await evaluate('=HLOOKUP("a", {"a", "b"; 1, 2}, 3, FALSE)')).toMatchObject({ code: '#REF!' });
  });
});
