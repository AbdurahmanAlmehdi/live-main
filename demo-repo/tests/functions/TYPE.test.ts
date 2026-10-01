// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('TYPE', () => {
  it('=TYPE(1)', async () => {
    expect(await evaluate('=TYPE(1)')).toBeCloseTo(1, 9);
  });
  it('=TYPE("x")', async () => {
    expect(await evaluate('=TYPE("x")')).toBeCloseTo(2, 8);
  });
  it('=TYPE(TRUE)', async () => {
    expect(await evaluate('=TYPE(TRUE)')).toBeCloseTo(4, 8);
  });
  it('=TYPE(#N/A)', async () => {
    expect(await evaluate('=TYPE(#N/A)')).toBeCloseTo(16, 7);
  });
  it('=TYPE({1, 2})', async () => {
    expect(await evaluate('=TYPE({1, 2})')).toBeCloseTo(64, 7);
  });
});
