// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('IFNA', () => {
  it('=IFNA(#N/A, "missing")', async () => {
    expect(await evaluate('=IFNA(#N/A, "missing")')).toBe('missing');
  });
  it('=IFNA(5, "missing")', async () => {
    expect(await evaluate('=IFNA(5, "missing")')).toBeCloseTo(5, 8);
  });
  it('=IFNA(1/0, "missing")', async () => {
    expect(await evaluate('=IFNA(1/0, "missing")')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=IFNA("x", 1)', async () => {
    expect(await evaluate('=IFNA("x", 1)')).toBe('x');
  });
  it('=IFNA(NA(), 0)', async () => {
    expect(await evaluate('=IFNA(NA(), 0)')).toBeCloseTo(0, 9);
  });
});
