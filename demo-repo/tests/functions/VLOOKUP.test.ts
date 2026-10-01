// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('VLOOKUP', () => {
  it('=VLOOKUP("cherry", {"apple", 1.5, 10; "banana", 0.25, 20; "cherry", 3, 30; "date", 2, 40}, 2, FALSE)', async () => {
    expect(await evaluate('=VLOOKUP("cherry", {"apple", 1.5, 10; "banana", 0.25, 20; "cherry", 3, 30; "date", 2, 40}, 2, FALSE)')).toBeCloseTo(3, 8);
  });
  it('=VLOOKUP("BANANA", {"apple", 1.5, 10; "banana", 0.25, 20; "cherry", 3, 30; "date", 2, 40}, 3, FALSE)', async () => {
    expect(await evaluate('=VLOOKUP("BANANA", {"apple", 1.5, 10; "banana", 0.25, 20; "cherry", 3, 30; "date", 2, 40}, 3, FALSE)')).toBeCloseTo(20, 7);
  });
  it('=VLOOKUP("d*", {"apple", 1.5, 10; "banana", 0.25, 20; "cherry", 3, 30; "date", 2, 40}, 2, FALSE)', async () => {
    expect(await evaluate('=VLOOKUP("d*", {"apple", 1.5, 10; "banana", 0.25, 20; "cherry", 3, 30; "date", 2, 40}, 2, FALSE)')).toBeCloseTo(2, 8);
  });
  it('=VLOOKUP(25, {10, "low"; 20, "mid"; 30, "high"; 40, "top"}, 2)', async () => {
    expect(await evaluate('=VLOOKUP(25, {10, "low"; 20, "mid"; 30, "high"; 40, "top"}, 2)')).toBe('mid');
  });
  it('=VLOOKUP(40, {10, "low"; 20, "mid"; 30, "high"; 40, "top"}, 2, TRUE)', async () => {
    expect(await evaluate('=VLOOKUP(40, {10, "low"; 20, "mid"; 30, "high"; 40, "top"}, 2, TRUE)')).toBe('top');
  });
  it('=VLOOKUP("kiwi", {"apple", 1.5, 10; "banana", 0.25, 20; "cherry", 3, 30; "date", 2, 40}, 2, FALSE)', async () => {
    expect(await evaluate('=VLOOKUP("kiwi", {"apple", 1.5, 10; "banana", 0.25, 20; "cherry", 3, 30; "date", 2, 40}, 2, FALSE)')).toMatchObject({ code: '#N/A' });
  });
  it('=VLOOKUP(5, {10, "low"; 20, "mid"; 30, "high"; 40, "top"}, 2)', async () => {
    expect(await evaluate('=VLOOKUP(5, {10, "low"; 20, "mid"; 30, "high"; 40, "top"}, 2)')).toMatchObject({ code: '#N/A' });
  });
  it('=VLOOKUP("apple", {"apple", 1.5, 10; "banana", 0.25, 20; "cherry", 3, 30; "date", 2, 40}, 4, FALSE)', async () => {
    expect(await evaluate('=VLOOKUP("apple", {"apple", 1.5, 10; "banana", 0.25, 20; "cherry", 3, 30; "date", 2, 40}, 4, FALSE)')).toMatchObject({ code: '#REF!' });
  });
});
