// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('IMAGINARY', () => {
  it('=IMAGINARY("3+4i")', async () => {
    expect(await evaluate('=IMAGINARY("3+4i")')).toBeCloseTo(4, 8);
  });
  it('=IMAGINARY("0-j")', async () => {
    expect(await evaluate('=IMAGINARY("0-j")')).toBeCloseTo(-1, 9);
  });
  it('=IMAGINARY("4")', async () => {
    expect(await evaluate('=IMAGINARY("4")')).toBeCloseTo(0, 9);
  });
  it('=IMAGINARY("-i")', async () => {
    expect(await evaluate('=IMAGINARY("-i")')).toBeCloseTo(-1, 9);
  });
  it('=IMAGINARY("2.5-1.5j")', async () => {
    expect(await evaluate('=IMAGINARY("2.5-1.5j")')).toBeCloseTo(-1.5, 8);
  });
  it('=IMAGINARY("3+4k")', async () => {
    expect(await evaluate('=IMAGINARY("3+4k")')).toMatchObject({ code: '#NUM!' });
  });
});
