// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('CHOOSE', () => {
  it('=CHOOSE(2, "a", "b", "c")', async () => {
    expect(await evaluate('=CHOOSE(2, "a", "b", "c")')).toBe('b');
  });
  it('=CHOOSE(1, 10, 20)', async () => {
    expect(await evaluate('=CHOOSE(1, 10, 20)')).toBeCloseTo(10, 8);
  });
  it('=CHOOSE(2.9, "x", "y", "z")', async () => {
    expect(await evaluate('=CHOOSE(2.9, "x", "y", "z")')).toBe('y');
  });
  it('=CHOOSE(3, 1, 2, TRUE)', async () => {
    expect(await evaluate('=CHOOSE(3, 1, 2, TRUE)')).toBe(true);
  });
  it('=CHOOSE(0, "a", "b")', async () => {
    expect(await evaluate('=CHOOSE(0, "a", "b")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=CHOOSE(4, "a", "b")', async () => {
    expect(await evaluate('=CHOOSE(4, "a", "b")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=CHOOSE("x", 1)', async () => {
    expect(await evaluate('=CHOOSE("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
