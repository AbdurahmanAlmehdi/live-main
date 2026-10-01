// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('IMABS', () => {
  it('=IMABS("5+12i")', async () => {
    expect(await evaluate('=IMABS("5+12i")')).toBeCloseTo(13, 7);
  });
  it('=IMABS("3-4j")', async () => {
    expect(await evaluate('=IMABS("3-4j")')).toBeCloseTo(5, 8);
  });
  it('=IMABS("-2")', async () => {
    expect(await evaluate('=IMABS("-2")')).toBeCloseTo(2, 8);
  });
  it('=IMABS("i")', async () => {
    expect(await evaluate('=IMABS("i")')).toBeCloseTo(1, 9);
  });
  it('=IMABS("1+i")', async () => {
    expect(await evaluate('=IMABS("1+i")')).toBeCloseTo(1.4142135623730951, 8);
  });
  it('=IMABS("x+i")', async () => {
    expect(await evaluate('=IMABS("x+i")')).toMatchObject({ code: '#NUM!' });
  });
});
