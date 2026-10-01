// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('PERMUT', () => {
  it('=PERMUT(100, 3)', async () => {
    expect(await evaluate('=PERMUT(100, 3)')).toBeCloseTo(970200, 3);
  });
  it('=PERMUT(3, 2)', async () => {
    expect(await evaluate('=PERMUT(3, 2)')).toBeCloseTo(6, 8);
  });
  it('=PERMUT(5, 0)', async () => {
    expect(await evaluate('=PERMUT(5, 0)')).toBeCloseTo(1, 9);
  });
  it('=PERMUT(5.9, 2.9)', async () => {
    expect(await evaluate('=PERMUT(5.9, 2.9)')).toBeCloseTo(20, 7);
  });
  it('=PERMUT(2, 3)', async () => {
    expect(await evaluate('=PERMUT(2, 3)')).toMatchObject({ code: '#NUM!' });
  });
  it('=PERMUT(-1, 0)', async () => {
    expect(await evaluate('=PERMUT(-1, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=PERMUT("x", 1)', async () => {
    expect(await evaluate('=PERMUT("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
