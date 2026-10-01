// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SUM', () => {
  it('=SUM(1, 2, 3)', async () => {
    expect(await evaluate('=SUM(1, 2, 3)')).toBeCloseTo(6, 8);
  });
  it('=SUM({1, 2; 3, 4})', async () => {
    expect(await evaluate('=SUM({1, 2; 3, 4})')).toBeCloseTo(10, 8);
  });
  it('=SUM({1, "a", TRUE}, 2)', async () => {
    expect(await evaluate('=SUM({1, "a", TRUE}, 2)')).toBeCloseTo(3, 8);
  });
  it('=SUM("3", TRUE)', async () => {
    expect(await evaluate('=SUM("3", TRUE)')).toBeCloseTo(4, 8);
  });
  it('=SUM(-1.5, 0.25)', async () => {
    expect(await evaluate('=SUM(-1.5, 0.25)')).toBeCloseTo(-1.25, 8);
  });
  it('=SUM()', async () => {
    expect(await evaluate('=SUM()')).toBeCloseTo(0, 9);
  });
  it('=SUM(1, "abc")', async () => {
    expect(await evaluate('=SUM(1, "abc")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=SUM({1, #N/A})', async () => {
    expect(await evaluate('=SUM({1, #N/A})')).toMatchObject({ code: '#N/A' });
  });
});
