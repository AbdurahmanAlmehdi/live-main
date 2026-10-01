// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('QUOTIENT', () => {
  it('=QUOTIENT(5, 2)', async () => {
    expect(await evaluate('=QUOTIENT(5, 2)')).toBeCloseTo(2, 8);
  });
  it('=QUOTIENT(4.5, 3.1)', async () => {
    expect(await evaluate('=QUOTIENT(4.5, 3.1)')).toBeCloseTo(1, 9);
  });
  it('=QUOTIENT(-10, 3)', async () => {
    expect(await evaluate('=QUOTIENT(-10, 3)')).toBeCloseTo(-3, 8);
  });
  it('=QUOTIENT(10, -3)', async () => {
    expect(await evaluate('=QUOTIENT(10, -3)')).toBeCloseTo(-3, 8);
  });
  it('=QUOTIENT(1, 0)', async () => {
    expect(await evaluate('=QUOTIENT(1, 0)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=QUOTIENT("x", 2)', async () => {
    expect(await evaluate('=QUOTIENT("x", 2)')).toMatchObject({ code: '#VALUE!' });
  });
});
