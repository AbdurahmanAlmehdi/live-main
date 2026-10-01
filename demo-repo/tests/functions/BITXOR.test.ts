// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('BITXOR', () => {
  it('=BITXOR(5, 3)', async () => {
    expect(await evaluate('=BITXOR(5, 3)')).toBeCloseTo(6, 8);
  });
  it('=BITXOR(7, 7)', async () => {
    expect(await evaluate('=BITXOR(7, 7)')).toBeCloseTo(0, 9);
  });
  it('=BITXOR(4294967297, 1)', async () => {
    expect(await evaluate('=BITXOR(4294967297, 1)')).toBeCloseTo(4294967296, -1);
  });
  it('=BITXOR(281474976710655, 1)', async () => {
    expect(await evaluate('=BITXOR(281474976710655, 1)')).toBeCloseTo(281474976710654, -6);
  });
  it('=BITXOR(1, 0.5)', async () => {
    expect(await evaluate('=BITXOR(1, 0.5)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BITXOR(1, -1)', async () => {
    expect(await evaluate('=BITXOR(1, -1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BITXOR("x", 1)', async () => {
    expect(await evaluate('=BITXOR("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
