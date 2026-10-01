// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('INDEX', () => {
  it('=INDEX({1, 2; 3, 4}, 2, 2)', async () => {
    expect(await evaluate('=INDEX({1, 2; 3, 4}, 2, 2)')).toBeCloseTo(4, 8);
  });
  it('=INDEX({1, 2; 3, 4}, 1, 2)', async () => {
    expect(await evaluate('=INDEX({1, 2; 3, 4}, 1, 2)')).toBeCloseTo(2, 8);
  });
  it('=INDEX({"a", "b", "c"}, 2)', async () => {
    expect(await evaluate('=INDEX({"a", "b", "c"}, 2)')).toBe('b');
  });
  it('=INDEX({"a"; "b"; "c"}, 3)', async () => {
    expect(await evaluate('=INDEX({"a"; "b"; "c"}, 3)')).toBe('c');
  });
  it('=INDEX({1, 2; 3, 4}, 3, 1)', async () => {
    expect(await evaluate('=INDEX({1, 2; 3, 4}, 3, 1)')).toMatchObject({ code: '#REF!' });
  });
  it('=INDEX({1, 2; 3, 4}, 1, 3)', async () => {
    expect(await evaluate('=INDEX({1, 2; 3, 4}, 1, 3)')).toMatchObject({ code: '#REF!' });
  });
  it('=INDEX({1, 2; 3, 4}, -1, 1)', async () => {
    expect(await evaluate('=INDEX({1, 2; 3, 4}, -1, 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
