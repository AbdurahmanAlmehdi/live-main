// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('IMREAL', () => {
  it('=IMREAL("6-9i")', async () => {
    expect(await evaluate('=IMREAL("6-9i")')).toBeCloseTo(6, 8);
  });
  it('=IMREAL("-2.5+i")', async () => {
    expect(await evaluate('=IMREAL("-2.5+i")')).toBeCloseTo(-2.5, 8);
  });
  it('=IMREAL("4j")', async () => {
    expect(await evaluate('=IMREAL("4j")')).toBeCloseTo(0, 9);
  });
  it('=IMREAL(7)', async () => {
    expect(await evaluate('=IMREAL(7)')).toBeCloseTo(7, 8);
  });
  it('=IMREAL("1e2-3i")', async () => {
    expect(await evaluate('=IMREAL("1e2-3i")')).toBeCloseTo(100, 7);
  });
  it('=IMREAL("abc")', async () => {
    expect(await evaluate('=IMREAL("abc")')).toMatchObject({ code: '#NUM!' });
  });
  it('=IMREAL(TRUE)', async () => {
    expect(await evaluate('=IMREAL(TRUE)')).toMatchObject({ code: '#VALUE!' });
  });
});
