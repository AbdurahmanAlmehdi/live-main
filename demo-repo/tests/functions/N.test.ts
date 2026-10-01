// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('N', () => {
  it('=N(7)', async () => {
    expect(await evaluate('=N(7)')).toBeCloseTo(7, 8);
  });
  it('=N(TRUE)', async () => {
    expect(await evaluate('=N(TRUE)')).toBeCloseTo(1, 9);
  });
  it('=N(FALSE)', async () => {
    expect(await evaluate('=N(FALSE)')).toBeCloseTo(0, 9);
  });
  it('=N("7")', async () => {
    expect(await evaluate('=N("7")')).toBeCloseTo(0, 9);
  });
  it('=N("x")', async () => {
    expect(await evaluate('=N("x")')).toBeCloseTo(0, 9);
  });
  it('=N(#N/A)', async () => {
    expect(await evaluate('=N(#N/A)')).toMatchObject({ code: '#N/A' });
  });
  it('=N({4, 5})', async () => {
    expect(await evaluate('=N({4, 5})')).toBeCloseTo(4, 8);
  });
});
