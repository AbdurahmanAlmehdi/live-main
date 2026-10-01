// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('LEN', () => {
  it('=LEN("Phoenix, AZ")', async () => {
    expect(await evaluate('=LEN("Phoenix, AZ")')).toBeCloseTo(11, 7);
  });
  it('=LEN("")', async () => {
    expect(await evaluate('=LEN("")')).toBeCloseTo(0, 9);
  });
  it('=LEN("  One   ")', async () => {
    expect(await evaluate('=LEN("  One   ")')).toBeCloseTo(8, 8);
  });
  it('=LEN(12.5)', async () => {
    expect(await evaluate('=LEN(12.5)')).toBeCloseTo(4, 8);
  });
  it('=LEN(TRUE)', async () => {
    expect(await evaluate('=LEN(TRUE)')).toBeCloseTo(4, 8);
  });
  it('=LEN(#N/A)', async () => {
    expect(await evaluate('=LEN(#N/A)')).toMatchObject({ code: '#N/A' });
  });
});
