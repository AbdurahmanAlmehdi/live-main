// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('IFERROR', () => {
  it('=IFERROR(1/0, "oops")', async () => {
    expect(await evaluate('=IFERROR(1/0, "oops")')).toBe('oops');
  });
  it('=IFERROR(5, "oops")', async () => {
    expect(await evaluate('=IFERROR(5, "oops")')).toBeCloseTo(5, 8);
  });
  it('=IFERROR(#N/A, 0)', async () => {
    expect(await evaluate('=IFERROR(#N/A, 0)')).toBeCloseTo(0, 9);
  });
  it('=IFERROR("x", 1)', async () => {
    expect(await evaluate('=IFERROR("x", 1)')).toBe('x');
  });
  it('=IFERROR(SQRT(-1), -1)', async () => {
    expect(await evaluate('=IFERROR(SQRT(-1), -1)')).toBeCloseTo(-1, 9);
  });
});
