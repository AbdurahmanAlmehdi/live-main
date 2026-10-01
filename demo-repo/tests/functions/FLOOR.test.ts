// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('FLOOR', () => {
  it('=FLOOR(3.7, 2)', async () => {
    expect(await evaluate('=FLOOR(3.7, 2)')).toBeCloseTo(2, 8);
  });
  it('=FLOOR(-2.5, -2)', async () => {
    expect(await evaluate('=FLOOR(-2.5, -2)')).toBeCloseTo(-2, 8);
  });
  it('=FLOOR(1.58, 0.1)', async () => {
    expect(await evaluate('=FLOOR(1.58, 0.1)')).toBeCloseTo(1.5, 8);
  });
  it('=FLOOR(0.234, 0.01)', async () => {
    expect(await evaluate('=FLOOR(0.234, 0.01)')).toBeCloseTo(0.23, 9);
  });
  it('=FLOOR(-2.5, 2)', async () => {
    expect(await evaluate('=FLOOR(-2.5, 2)')).toBeCloseTo(-4, 8);
  });
  it('=FLOOR(2.5, -2)', async () => {
    expect(await evaluate('=FLOOR(2.5, -2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=FLOOR(5, 0)', async () => {
    expect(await evaluate('=FLOOR(5, 0)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=FLOOR("x", 1)', async () => {
    expect(await evaluate('=FLOOR("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
