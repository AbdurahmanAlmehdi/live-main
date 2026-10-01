// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('MIN', () => {
  it('=MIN(10, 7, 9, 27, 2)', async () => {
    expect(await evaluate('=MIN(10, 7, 9, 27, 2)')).toBeCloseTo(2, 8);
  });
  it('=MIN({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})', async () => {
    expect(await evaluate('=MIN({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})')).toBeCloseTo(2, 8);
  });
  it('=MIN({5, "a", FALSE}, 3)', async () => {
    expect(await evaluate('=MIN({5, "a", FALSE}, 3)')).toBeCloseTo(3, 8);
  });
  it('=MIN("-4", TRUE)', async () => {
    expect(await evaluate('=MIN("-4", TRUE)')).toBeCloseTo(-4, 8);
  });
  it('=MIN({"x"})', async () => {
    expect(await evaluate('=MIN({"x"})')).toBeCloseTo(0, 9);
  });
  it('=MIN(-5, -2)', async () => {
    expect(await evaluate('=MIN(-5, -2)')).toBeCloseTo(-5, 8);
  });
  it('=MIN(1, #N/A)', async () => {
    expect(await evaluate('=MIN(1, #N/A)')).toMatchObject({ code: '#N/A' });
  });
});
